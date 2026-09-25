'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { signIn } from '@/auth'
import { getUsuarioLogado } from '@/lib/usuario-logado'
import { AuthError } from 'next-auth'
import { UTApi } from "uploadthing/server"
import type { ActionResult } from '@/types'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// =============================================================================
// MÓDULO BANCOS — helper interno de estorno de saldo
// =============================================================================

async function estornarSaldoBanco(
  tx: import('@prisma/client').Prisma.TransactionClient,
  lancamento: { id: string; tipo: string; valor: unknown; banco_id: string | null; status: string }
) {
  if (!lancamento.banco_id || lancamento.status !== 'PAGO') return

  const banco = await tx.banco.findUnique({ where: { id: lancamento.banco_id } })
  if (!banco) return

  const atual = Number(banco.saldo_atual)
  const delta = lancamento.tipo === 'RECEITA' ? -Number(lancamento.valor) : Number(lancamento.valor)
  const novo = Math.round((atual + delta) * 100) / 100

  await tx.banco.update({ where: { id: banco.id }, data: { saldo_atual: novo } })
  await tx.movimentacaoBanco.deleteMany({ where: { lancamento_id: lancamento.id } })
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', {
        ...Object.fromEntries(formData),
        redirectTo: '/',
    })
  } catch (error) {
    if ((error as Error).message.includes('NEXT_REDIRECT')) {
        throw error;
    }
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin': return 'Credenciais inválidas. Verifique e-mail e senha.'
        case 'CallbackRouteError': return 'Erro ao tentar login. Usuário inativo?'
        default: return 'Algo deu errado. Tente novamente.'
      }
    }
    throw error
  }
}

export async function registrar(
  prevState: string | undefined,
  formData: FormData,
) {
  const nome = (formData.get('nome') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const senha = formData.get('senha') as string
  const confirmarSenha = formData.get('confirmar_senha') as string

  if (!nome) return 'Nome é obrigatório.'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.'
  if (!senha || senha.length < 6) return 'A senha deve ter ao menos 6 caracteres.'
  if (senha !== confirmarSenha) return 'As senhas não coincidem.'

  const existente = await prisma.usuario.findUnique({ where: { email } })
  if (existente) return 'Este e-mail já está cadastrado.'

  try {
    await prisma.usuario.create({
      data: { nome, email, senha: await bcrypt.hash(senha, 10) },
    })
  } catch {
    return 'Erro ao criar conta. Tente novamente.'
  }

  try {
    await signIn('credentials', {
      email,
      password: senha,
      redirectTo: '/',
    })
  } catch (error) {
    if ((error as Error).message.includes('NEXT_REDIRECT')) {
      throw error
    }
    if (error instanceof AuthError) {
      return 'Conta criada. Faça login para continuar.'
    }
    throw error
  }
}

// =============================================================================
// MÓDULO USUÁRIO — Configurações
// =============================================================================

export async function atualizarUsuario(formData: FormData): Promise<ActionResult<{ emailAlterado: boolean }>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const nome = (formData.get('nome') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const novaSenha = formData.get('senha') as string
    const confirmarSenha = formData.get('confirmar_senha') as string

    if (!nome) return { success: false, error: 'Nome é obrigatório.' }
    if (!email) return { success: false, error: 'E-mail é obrigatório.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'E-mail inválido.' }

    if (novaSenha || confirmarSenha) {
      if (novaSenha.length < 6) return { success: false, error: 'A nova senha deve ter ao menos 6 caracteres.' }
      if (novaSenha !== confirmarSenha) return { success: false, error: 'As senhas não coincidem.' }
    }

    if (email !== usuario.email) {
      const existente = await prisma.usuario.findUnique({ where: { email } })
      if (existente) return { success: false, error: 'Este e-mail já está em uso.' }
    }

    const data: import('@prisma/client').Prisma.UsuarioUpdateInput = { nome, email }
    if (novaSenha) data.senha = await bcrypt.hash(novaSenha, 10)

    await prisma.usuario.update({ where: { id: usuario.id }, data })

    revalidatePath('/', 'layout')
    return { success: true, data: { emailAlterado: email !== usuario.email } }
  } catch {
    return { success: false, error: 'Erro ao atualizar usuário.' }
  }
}

// =============================================================================
// MÓDULO FINANCEIRO
// =============================================================================

// --- PLANO DE CONTAS ---

export async function criarPlanoContas(formData: FormData): Promise<ActionResult<import('@prisma/client').PlanoContas>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const nome = formData.get('nome') as string
    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }
    if (!['DESPESA', 'RECEITA'].includes(tipo)) return { success: false, error: 'Tipo inválido.' }

    const conta = await prisma.planoContas.create({
      data: { tipo, nome: nome.trim() }
    })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: conta }
  } catch {
    return { success: false, error: 'Erro ao criar conta.' }
  }
}

export async function editarPlanoContas(formData: FormData): Promise<ActionResult<import('@prisma/client').PlanoContas>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const id = formData.get('id') as string
    const nome = formData.get('nome') as string
    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }

    const conta = await prisma.planoContas.findFirst({ where: { id } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    const atualizada = await prisma.planoContas.update({
      where: { id },
      data: { nome: nome.trim(), tipo }
    })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: atualizada }
  } catch {
    return { success: false, error: 'Erro ao editar conta.' }
  }
}

export async function excluirPlanoContas(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const conta = await prisma.planoContas.findFirst({ where: { id } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    const emUso = await prisma.lancamentoFinanceiro.count({ where: { plano_contas_id: id } })
    if (emUso > 0) return { success: false, error: 'Esta conta possui lançamentos vinculados e não pode ser excluída.' }

    await prisma.planoContas.delete({ where: { id } })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir conta.' }
  }
}

export async function toggleAtivoPlanoContas(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const conta = await prisma.planoContas.findFirst({ where: { id } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    await prisma.planoContas.update({ where: { id }, data: { ativo: !conta.ativo } })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao alterar status da conta.' }
  }
}

// --- LANÇAMENTOS FINANCEIROS ---

export async function criarLancamento(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'
    const descricao = (formData.get('descricao') as string)?.trim()
    const beneficiario = (formData.get('beneficiario') as string)?.trim() || null
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const dt_vencimento = new Date(formData.get('dt_vencimento') as string)
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const plano_contas_id = formData.get('plano_contas_id') as string
    const recorrencia = (formData.get('recorrencia') as string || 'NAO') as import('@prisma/client').Recorrencia
    const numero_parcelas = parseInt(formData.get('numero_parcelas') as string) || 1
    const banco_id = (formData.get('banco_id') as string) || null

    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }
    if (!plano_contas_id) return { success: false, error: 'Categoria é obrigatória.' }

    const conta = await prisma.planoContas.findFirst({ where: { id: plano_contas_id } })
    if (!conta) return { success: false, error: 'Categoria não encontrada.' }

    if (numero_parcelas > 1) {
      const grupoParcela = crypto.randomUUID()

      for (let i = 1; i <= numero_parcelas; i++) {
        const dtParcela = new Date(dt_vencimento)
        dtParcela.setMonth(dtParcela.getMonth() + (i - 1))
        await prisma.lancamentoFinanceiro.create({
          data: {
            tipo,
            descricao,
            beneficiario,
            valor,
            dt_vencimento: dtParcela,
            numero_documento,
            plano_contas_id,
            recorrencia: 'NAO',
            numero_parcelas,
            parcela_atual: i,
            grupo_parcela_id: grupoParcela,
            banco_id,
          }
        })
      }
    } else {
      await prisma.lancamentoFinanceiro.create({
        data: {
          tipo,
          descricao,
          beneficiario,
          valor,
          dt_vencimento,
          numero_documento,
          plano_contas_id,
          recorrencia,
          banco_id,
        }
      })
    }

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao criar lançamento.' }
  }
}

export async function editarLancamento(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const id = formData.get('id') as string
    const descricao = (formData.get('descricao') as string)?.trim()
    const beneficiario = (formData.get('beneficiario') as string)?.trim() || null
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const dt_vencimento = new Date(formData.get('dt_vencimento') as string)
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const plano_contas_id = formData.get('plano_contas_id') as string
    const banco_id = (formData.get('banco_id') as string) || null

    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    // O vínculo com banco só pode mudar antes de o lançamento ser pago —
    // depois disso o saldo já foi sincronizado e alterar o vínculo dessincronizaria o extrato.
    const podeAlterarBanco = lancamento.status !== 'PAGO'

    await prisma.lancamentoFinanceiro.update({
      where: { id },
      data: {
        descricao, beneficiario, valor, dt_vencimento, numero_documento, plano_contas_id,
        ...(podeAlterarBanco ? { banco_id } : {}),
      }
    })

    const aplicarATodos = formData.get('aplicar_a_todos') === 'true'
    if (aplicarATodos && lancamento.grupo_parcela_id) {
      await prisma.lancamentoFinanceiro.updateMany({
        where: { grupo_parcela_id: lancamento.grupo_parcela_id, id: { not: id } },
        data: { descricao, beneficiario, valor, numero_documento, plano_contas_id },
      })
      // O banco só é propagado às parcelas-irmãs que ainda não foram pagas (mesma regra do individual).
      if (podeAlterarBanco) {
        await prisma.lancamentoFinanceiro.updateMany({
          where: { grupo_parcela_id: lancamento.grupo_parcela_id, id: { not: id }, status: { not: 'PAGO' } },
          data: { banco_id },
        })
      }
    }

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao editar lançamento.' }
  }
}

export async function excluirGrupoParcelas(grupo_parcela_id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { grupo_parcela_id },
    })
    const idsArr = lancamentos.map(l => l.id)

    await prisma.$transaction(async (tx) => {
      for (const l of lancamentos) {
        await estornarSaldoBanco(tx, l)
      }
      await tx.anexoFinanceiro.deleteMany({ where: { lancamento_id: { in: idsArr } } })
      await tx.lancamentoFinanceiro.deleteMany({ where: { id: { in: idsArr } } })
    })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    revalidatePath('/financeiro/bancos')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir grupo de parcelas.' }
  }
}

export async function excluirParcelasAPartirDesta(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id },
      select: { grupo_parcela_id: true, parcela_atual: true },
    })
    if (!lancamento?.grupo_parcela_id || lancamento.parcela_atual == null) {
      return { success: false, error: 'Parcela inválida.' }
    }

    const alvos = await prisma.lancamentoFinanceiro.findMany({
      where: {
        grupo_parcela_id: lancamento.grupo_parcela_id,
        parcela_atual: { gte: lancamento.parcela_atual },
        status: { not: 'PAGO' },
      },
      select: { id: true },
    })
    const idsArr = alvos.map(l => l.id)

    await prisma.anexoFinanceiro.deleteMany({ where: { lancamento_id: { in: idsArr } } })
    await prisma.lancamentoFinanceiro.deleteMany({ where: { id: { in: idsArr } } })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir parcelas.' }
  }
}

export async function pagarLancamento(id: string, dt_pagamento: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.$transaction(async (tx) => {
      await tx.lancamentoFinanceiro.update({
        where: { id },
        data: { status: 'PAGO', dt_pagamento: new Date(dt_pagamento) }
      })

      if (lancamento.banco_id) {
        const banco = await tx.banco.findUnique({ where: { id: lancamento.banco_id } })
        if (banco) {
          const atual = Number(banco.saldo_atual)
          const delta = lancamento.tipo === 'RECEITA' ? Number(lancamento.valor) : -Number(lancamento.valor)
          const novo = Math.round((atual + delta) * 100) / 100

          await tx.banco.update({ where: { id: banco.id }, data: { saldo_atual: novo } })
          await tx.lancamentoFinanceiro.update({
            where: { id },
            data: { saldo_banco_anterior: atual, saldo_banco_posterior: novo },
          })
          await tx.movimentacaoBanco.create({
            data: {
              banco_id: banco.id,
              lancamento_id: id,
              tipo: lancamento.tipo === 'RECEITA' ? 'ENTRADA' : 'SAIDA',
              descricao: lancamento.descricao,
              valor: Number(lancamento.valor),
              saldo_anterior: atual,
              saldo_posterior: novo,
            },
          })
        }
      }

      if (lancamento.recorrencia !== 'NAO') {
        const baseDate = new Date(lancamento.dt_vencimento)
        let proxData: Date

        if (lancamento.recorrencia === 'DIARIAMENTE') {
          proxData = new Date(baseDate)
          proxData.setDate(proxData.getDate() + 1)
        } else if (lancamento.recorrencia === 'SEMANALMENTE') {
          proxData = new Date(baseDate)
          proxData.setDate(proxData.getDate() + 7)
        } else {
          proxData = new Date(baseDate)
          proxData.setMonth(proxData.getMonth() + 1)
        }

        await tx.lancamentoFinanceiro.create({
          data: {
            tipo: lancamento.tipo,
            descricao: lancamento.descricao,
            beneficiario: lancamento.beneficiario,
            valor: lancamento.valor,
            dt_vencimento: proxData,
            numero_documento: lancamento.numero_documento,
            plano_contas_id: lancamento.plano_contas_id,
            recorrencia: lancamento.recorrencia,
            status: 'PENDENTE',
            lancamento_pai_id: id,
            banco_id: lancamento.banco_id,
          }
        })
      }
    })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    revalidatePath('/financeiro/bancos')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao registrar pagamento.' }
  }
}

export async function registrarPagamentoParcial(
  lancamentoId: string,
  valor: number,
  dt_pagamento: string,
  observacao: string | null,
): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    if (typeof valor !== 'number' || isNaN(valor) || valor <= 0) {
      return { success: false, error: 'Valor do parcial inválido.' }
    }
    if (!dt_pagamento) return { success: false, error: 'Data do parcial é obrigatória.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id: lancamentoId },
      include: { parciais: true },
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }
    if (lancamento.status === 'CANCELADO') return { success: false, error: 'Lançamento cancelado não aceita parciais.' }
    if (lancamento.status === 'PAGO') return { success: false, error: 'Lançamento já está quitado.' }

    const total = Number(lancamento.valor)
    const jaPago = lancamento.parciais.reduce((s, p) => s + Number(p.valor), 0)
    const restante = Math.round((total - jaPago) * 100) / 100
    const valorParcial = Math.round(valor * 100) / 100

    if (valorParcial > restante) {
      return { success: false, error: `O parcial (R$ ${valorParcial.toFixed(2)}) ultrapassa o saldo restante (R$ ${restante.toFixed(2)}).` }
    }

    await prisma.pagamentoParcial.create({
      data: {
        lancamento_id: lancamentoId,
        valor: valorParcial,
        dt_pagamento: new Date(dt_pagamento),
        observacao: observacao?.trim() || null,
      },
    })

    const novoTotal = Math.round((jaPago + valorParcial) * 100) / 100
    if (novoTotal >= total) {
      await prisma.lancamentoFinanceiro.update({
        where: { id: lancamentoId },
        data: { status: 'PAGO', dt_pagamento: new Date(dt_pagamento) },
      })

      if (lancamento.recorrencia !== 'NAO') {
        const baseDate = new Date(lancamento.dt_vencimento)
        let proxData: Date
        if (lancamento.recorrencia === 'DIARIAMENTE') { proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 1) }
        else if (lancamento.recorrencia === 'SEMANALMENTE') { proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 7) }
        else { proxData = new Date(baseDate); proxData.setMonth(proxData.getMonth() + 1) }

        await prisma.lancamentoFinanceiro.create({
          data: {
            tipo: lancamento.tipo,
            descricao: lancamento.descricao,
            beneficiario: lancamento.beneficiario,
            valor: lancamento.valor,
            dt_vencimento: proxData,
            numero_documento: lancamento.numero_documento,
            plano_contas_id: lancamento.plano_contas_id,
            recorrencia: lancamento.recorrencia,
            status: 'PENDENTE',
            lancamento_pai_id: lancamentoId,
          }
        })
      }
    }

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao registrar parcial.' }
  }
}

export async function excluirPagamentoParcial(parcialId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const parcial = await prisma.pagamentoParcial.findUnique({
      where: { id: parcialId },
      include: { lancamento: true },
    })
    if (!parcial) {
      return { success: false, error: 'Parcial não encontrado.' }
    }

    if (parcial.lancamento.status !== 'PENDENTE') {
      return { success: false, error: 'Lançamento já quitado ou cancelado — não é possível remover parciais.' }
    }

    await prisma.pagamentoParcial.delete({ where: { id: parcialId } })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao remover parcial.' }
  }
}

export async function excluirEAvancarRecorrencia(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    const baseDate = new Date(lancamento.dt_vencimento)
    let proxData: Date

    if (lancamento.recorrencia === 'DIARIAMENTE') {
      proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 1)
    } else if (lancamento.recorrencia === 'SEMANALMENTE') {
      proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 7)
    } else {
      proxData = new Date(baseDate); proxData.setMonth(proxData.getMonth() + 1)
    }

    await prisma.$transaction(async (tx) => {
      await estornarSaldoBanco(tx, lancamento)
      await tx.anexoFinanceiro.deleteMany({ where: { lancamento_id: id } })
      await tx.lancamentoFinanceiro.delete({ where: { id } })

      await tx.lancamentoFinanceiro.create({
        data: {
          tipo: lancamento.tipo,
          descricao: lancamento.descricao,
          beneficiario: lancamento.beneficiario,
          valor: lancamento.valor,
          dt_vencimento: proxData,
          numero_documento: lancamento.numero_documento,
          plano_contas_id: lancamento.plano_contas_id,
          recorrencia: lancamento.recorrencia,
          status: 'PENDENTE',
          lancamento_pai_id: id,
          banco_id: lancamento.banco_id,
        }
      })
    })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    revalidatePath('/financeiro/bancos')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao processar lançamento.' }
  }
}

export async function cancelarLancamento(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.lancamentoFinanceiro.update({ where: { id }, data: { status: 'CANCELADO' } })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao cancelar lançamento.' }
  }
}

export async function excluirLancamento(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.$transaction(async (tx) => {
      await estornarSaldoBanco(tx, lancamento)
      await tx.anexoFinanceiro.deleteMany({ where: { lancamento_id: id } })
      await tx.lancamentoFinanceiro.delete({ where: { id } })
    })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    revalidatePath('/financeiro/bancos')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir lançamento.' }
  }
}

export async function salvarAnexoFinanceiro(dados: {
  lancamento_id: string
  nome: string
  url: string
  key: string
  tamanho: number
}): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id: dados.lancamento_id }
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.anexoFinanceiro.create({
      data: {
        lancamento_id: dados.lancamento_id,
        nome: dados.nome,
        url: dados.url,
        key: dados.key,
        tamanho: dados.tamanho,
      }
    })
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao salvar anexo.' }
  }
}

export async function excluirAnexoFinanceiro(anexoId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const anexo = await prisma.anexoFinanceiro.findUnique({ where: { id: anexoId } })
    if (!anexo) return { success: false, error: 'Anexo não encontrado.' }

    const utapi = new UTApi()
    await utapi.deleteFiles([anexo.key])
    await prisma.anexoFinanceiro.delete({ where: { id: anexoId } })
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir anexo.' }
  }
}

export async function getLancamentosFinanceiros(
  tipo: 'DESPESA' | 'RECEITA',
  filtros?: { dataInicio?: string; dataFim?: string; status?: string; plano_contas_id?: string }
) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return []

  const where: import('@prisma/client').Prisma.LancamentoFinanceiroWhereInput = {
    tipo,
  }

  if (filtros?.dataInicio && filtros?.dataFim) {
    where.dt_vencimento = {
      gte: new Date(`${filtros.dataInicio}T00:00:00.000Z`),
      lte: new Date(`${filtros.dataFim}T23:59:59.999Z`),
    }
  }

  if (filtros?.status && filtros.status !== 'TODOS') {
    where.status = filtros.status as import('@prisma/client').StatusLancamento
  }

  if (filtros?.plano_contas_id && filtros.plano_contas_id !== 'TODAS') {
    where.plano_contas_id = filtros.plano_contas_id
  }

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where,
    include: { plano_contas: true, anexos: true, banco: true, parciais: { orderBy: { dt_pagamento: 'asc' } } },
    orderBy: { dt_vencimento: 'asc' },
  })
  return lancamentos.map(l => ({
    ...l,
    valor: Number(l.valor),
    saldo_banco_anterior: l.saldo_banco_anterior != null ? Number(l.saldo_banco_anterior) : null,
    saldo_banco_posterior: l.saldo_banco_posterior != null ? Number(l.saldo_banco_posterior) : null,
    banco: l.banco ? { ...l.banco, saldo_inicial: Number(l.banco.saldo_inicial), saldo_atual: Number(l.banco.saldo_atual) } : null,
    parciais: l.parciais.map(p => ({ ...p, valor: Number(p.valor) })),
  }))
}

export async function getBalancete(dataInicio: string, dataFim: string) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return null

  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  fim.setHours(23, 59, 59, 999)

  const [noPeriodo, todosPagos, parciaisPendentes] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: {
        status: { not: 'CANCELADO' },
        dt_vencimento: { gte: inicio, lte: fim },
      },
      include: { plano_contas: true, parciais: { select: { valor: true } } }
    }),
    prisma.lancamentoFinanceiro.findMany({
      where: { status: 'PAGO' },
      select: { tipo: true, valor: true }
    }),
    prisma.pagamentoParcial.findMany({
      where: { lancamento: { status: 'PENDENTE' } },
      select: { valor: true, lancamento: { select: { tipo: true } } }
    }),
  ])

  const toNumber = (v: unknown) => typeof v === 'object' && v !== null && 'toNumber' in v ? (v as { toNumber: () => number }).toNumber() : Number(v)
  const somaParciais = (l: { parciais?: { valor: unknown }[] }) => (l.parciais ?? []).reduce((s, p) => s + toNumber(p.valor), 0)

  const receitas = noPeriodo.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + toNumber(l.valor), 0)
  const despesas = noPeriodo.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + toNumber(l.valor), 0)
  const lucro = receitas - despesas

  const parciaisRealizadosReceita = parciaisPendentes.filter(p => p.lancamento.tipo === 'RECEITA').reduce((s, p) => s + toNumber(p.valor), 0)
  const parciaisRealizadosDespesa = parciaisPendentes.filter(p => p.lancamento.tipo === 'DESPESA').reduce((s, p) => s + toNumber(p.valor), 0)

  const saldoReceitas = todosPagos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + toNumber(l.valor), 0) + parciaisRealizadosReceita
  const saldoDespesas = todosPagos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + toNumber(l.valor), 0) + parciaisRealizadosDespesa
  const saldo = saldoReceitas - saldoDespesas

  const a_receber = noPeriodo
    .filter(l => l.tipo === 'RECEITA' && l.status === 'PENDENTE')
    .reduce((s, l) => s + Math.max(0, toNumber(l.valor) - somaParciais(l)), 0)
  const a_pagar = noPeriodo
    .filter(l => l.tipo === 'DESPESA' && l.status === 'PENDENTE')
    .reduce((s, l) => s + Math.max(0, toNumber(l.valor) - somaParciais(l)), 0)

  const receitasPorConta = new Map<string, { nome: string; total: number }>()
  const despesasPorConta = new Map<string, { nome: string; total: number }>()

  for (const l of noPeriodo) {
    const mapa = l.tipo === 'RECEITA' ? receitasPorConta : despesasPorConta
    const atual = mapa.get(l.plano_contas_id) ?? { nome: l.plano_contas.nome, total: 0 }
    mapa.set(l.plano_contas_id, { nome: l.plano_contas.nome, total: atual.total + toNumber(l.valor) })
  }

  const mesesMap = new Map<string, { receitas: number; despesas: number }>()
  for (const l of noPeriodo) {
    const dt = new Date(l.dt_vencimento)
    const chave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    const atual = mesesMap.get(chave) ?? { receitas: 0, despesas: 0 }
    if (l.tipo === 'RECEITA') atual.receitas += toNumber(l.valor)
    else atual.despesas += toNumber(l.valor)
    mesesMap.set(chave, atual)
  }

  const mesesPtBR: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
  }

  const dados_mensais = Array.from(mesesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, v]) => {
      const [ano, mes] = chave.split('-')
      return {
        mes: `${mesesPtBR[mes]}/${ano.slice(2)}`,
        receitas: v.receitas,
        despesas: v.despesas,
        lucro: Math.max(0, v.receitas - v.despesas),
      }
    })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const em90dias = new Date(hoje)
  em90dias.setDate(hoje.getDate() + 90)

  const parcelasReceita = await prisma.lancamentoFinanceiro.findMany({
    where: {
      tipo: 'RECEITA',
      status: { not: 'CANCELADO' },
      grupo_parcela_id: { not: null },
    },
    select: {
      id: true,
      descricao: true,
      valor: true,
      dt_vencimento: true,
      grupo_parcela_id: true,
      parcela_atual: true,
      status: true,
    },
    orderBy: { dt_vencimento: 'asc' },
  })

  const gruposMap = new Map<string, typeof parcelasReceita>()
  for (const p of parcelasReceita) {
    if (!p.grupo_parcela_id) continue
    const grupo = gruposMap.get(p.grupo_parcela_id) ?? []
    grupo.push(p)
    gruposMap.set(p.grupo_parcela_id, grupo)
  }

  const contratos_encerrando = []
  for (const [, parcelas] of gruposMap) {
    const ultima = parcelas[parcelas.length - 1]
    const dtUltima = new Date(ultima.dt_vencimento)
    dtUltima.setHours(0, 0, 0, 0)
    if (dtUltima > em90dias) continue

    const diasRestantes = Math.ceil((dtUltima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    if (diasRestantes < 0) continue

    const parcelasRestantes = parcelas.filter(p => p.status === 'PENDENTE').length
    const totalParcelas = parcelas.length

    contratos_encerrando.push({
      id: parcelas[0].id,
      descricao: parcelas[0].descricao ?? '',
      valor: toNumber(parcelas[0].valor),
      dt_ultima_parcela: dtUltima.toISOString().split('T')[0],
      dias_restantes: diasRestantes,
      parcelas_restantes: parcelasRestantes,
      total_parcelas: totalParcelas,
    })
  }

  contratos_encerrando.sort((a, b) => a.dias_restantes - b.dias_restantes)

  const lancamentosPorConta = new Map<string, { descricao: string; valor: number; status: string; dt_vencimento: Date }[]>()
  for (const l of noPeriodo) {
    const lista = lancamentosPorConta.get(l.plano_contas_id) ?? []
    lista.push({
      descricao: l.descricao ?? '(sem descrição)',
      valor: toNumber(l.valor),
      status: l.status,
      dt_vencimento: l.dt_vencimento,
    })
    lancamentosPorConta.set(l.plano_contas_id, lista)
  }

  return {
    receitas,
    despesas,
    lucro,
    saldo,
    a_receber,
    a_pagar,
    receitas_por_conta: Array.from(receitasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, nome: v.nome, total: v.total })),
    despesas_por_conta: Array.from(despesasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, nome: v.nome, total: v.total })),
    lancamentos_por_conta: Object.fromEntries(lancamentosPorConta),
    dados_mensais,
    contratos_encerrando,
  }
}

// =============================================================================
// MÓDULO SISTEMA — Configurações globais
// =============================================================================

export async function getConfiguracaoSistema(): Promise<{ controle_bancos_ativo: boolean }> {
  const usuario = await getUsuarioLogado()
  if (!usuario) return { controle_bancos_ativo: false }

  const config = await prisma.configuracaoSistema.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' },
  })
  return { controle_bancos_ativo: config.controle_bancos_ativo }
}

export async function toggleControleBancos(): Promise<ActionResult<{ controle_bancos_ativo: boolean }>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const atual = await prisma.configuracaoSistema.upsert({
      where: { id: 'global' },
      update: {},
      create: { id: 'global' },
    })
    const atualizado = await prisma.configuracaoSistema.update({
      where: { id: 'global' },
      data: { controle_bancos_ativo: !atual.controle_bancos_ativo },
    })

    revalidatePath('/', 'layout')
    return { success: true, data: { controle_bancos_ativo: atualizado.controle_bancos_ativo } }
  } catch {
    return { success: false, error: 'Erro ao alterar configuração.' }
  }
}

// =============================================================================
// MÓDULO BANCOS
// =============================================================================

export async function criarBanco(formData: FormData): Promise<ActionResult<import('@/types').Banco>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const nome = (formData.get('nome') as string)?.trim()
    const saldoStr = formData.get('saldo_inicial') as string
    const saldo_inicial = parseFloat(saldoStr.replace(',', '.'))

    if (!nome) return { success: false, error: 'Nome é obrigatório.' }
    if (isNaN(saldo_inicial)) return { success: false, error: 'Saldo inicial inválido.' }

    const banco = await prisma.$transaction(async (tx) => {
      const novoBanco = await tx.banco.create({
        data: { nome, saldo_inicial, saldo_atual: saldo_inicial },
      })
      await tx.movimentacaoBanco.create({
        data: {
          banco_id: novoBanco.id,
          tipo: 'AJUSTE_INICIAL',
          descricao: 'Saldo inicial',
          valor: saldo_inicial,
          saldo_anterior: 0,
          saldo_posterior: saldo_inicial,
        },
      })
      return novoBanco
    })

    revalidatePath('/financeiro/bancos')
    revalidatePath('/financeiro/balancete')
    return {
      success: true,
      data: { ...banco, saldo_inicial: Number(banco.saldo_inicial), saldo_atual: Number(banco.saldo_atual) },
    }
  } catch {
    return { success: false, error: 'Erro ao criar banco.' }
  }
}

export async function toggleAtivoBanco(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const banco = await prisma.banco.findFirst({ where: { id } })
    if (!banco) return { success: false, error: 'Banco não encontrado.' }

    await prisma.banco.update({ where: { id }, data: { ativo: !banco.ativo } })

    revalidatePath('/financeiro/bancos')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao alterar status do banco.' }
  }
}

export async function excluirBanco(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const banco = await prisma.banco.findFirst({ where: { id } })
    if (!banco) return { success: false, error: 'Banco não encontrado.' }

    const emUso = await prisma.lancamentoFinanceiro.count({ where: { banco_id: id } })
    if (emUso > 0) return { success: false, error: 'Este banco possui lançamentos vinculados e não pode ser excluído.' }

    await prisma.banco.delete({ where: { id } })

    revalidatePath('/financeiro/bancos')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir banco.' }
  }
}

export async function getExtratoBanco(bancoId: string) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return []

  const movimentacoes = await prisma.movimentacaoBanco.findMany({
    where: { banco_id: bancoId },
    orderBy: { dt_movimento: 'desc' },
  })
  return movimentacoes.map(m => ({
    ...m,
    valor: Number(m.valor),
    saldo_anterior: Number(m.saldo_anterior),
    saldo_posterior: Number(m.saldo_posterior),
  }))
}
