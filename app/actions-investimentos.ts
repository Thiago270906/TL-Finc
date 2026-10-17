'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getUsuarioLogado } from '@/lib/usuario-logado'
import type { ActionResult, InvestimentoComBanco, TipoInvestimento } from '@/types'

// =============================================================================
// MÓDULO INVESTIMENTOS — aporte/resgate que movimenta de verdade o saldo do
// banco vinculado (débito no aporte, crédito no resgate), com rastro em
// MovimentacaoBanco via investimento_id. Diferente de transferirEntreContas
// (app/actions.ts), que usa lancamento_id null como marcador implícito, aqui
// usamos um FK dedicado para não contaminar a lista de "Transferências".
// =============================================================================

// Soma todos os movimentos do usuário num banco específico: +valor se APORTE,
// -valor se RESGATE. ignorarId exclui o próprio registro (usado na edição,
// pra recalcular sem contar a versão antiga dele mesmo).
async function getSaldoInvestido(usuario_id: string, banco_id: string, ignorarId?: string): Promise<number> {
  const investimentos = await prisma.investimento.findMany({
    where: {
      usuario_id,
      banco_id,
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    select: { tipo: true, valor: true },
  })
  return investimentos.reduce((acc, inv) => acc + (inv.tipo === 'APORTE' ? Number(inv.valor) : -Number(inv.valor)), 0)
}

export async function getInvestimentos(): Promise<InvestimentoComBanco[]> {
  const usuario = await getUsuarioLogado()
  if (!usuario) return []

  const investimentos = await prisma.investimento.findMany({
    where: { usuario_id: usuario.id },
    include: { banco: { select: { id: true, nome: true } } },
    orderBy: { dt_movimento: 'desc' },
  })
  return investimentos.map(i => ({
    ...i,
    valor: Number(i.valor),
    saldo_banco_anterior: Number(i.saldo_banco_anterior),
    saldo_banco_posterior: Number(i.saldo_banco_posterior),
  }))
}

export async function criarInvestimento(formData: FormData): Promise<ActionResult<InvestimentoComBanco>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const tipo = formData.get('tipo') as TipoInvestimento
    const descricao = (formData.get('descricao') as string)?.trim()
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const banco_id = formData.get('banco_id') as string
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const dtStr = formData.get('dt_movimento') as string
    const dt_movimento = dtStr ? new Date(`${dtStr}T12:00:00`) : new Date()

    if (tipo !== 'APORTE' && tipo !== 'RESGATE') return { success: false, error: 'Tipo inválido.' }
    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }
    if (!banco_id) return { success: false, error: 'Selecione o banco de onde o dinheiro vai sair/voltar.' }

    const resultado = await prisma.$transaction(async (tx) => {
      const banco = await tx.banco.findFirst({ where: { id: banco_id, usuario_id: usuario.id } })
      if (!banco) throw new Error('Banco não encontrado.')
      if (!banco.ativo) throw new Error('Não é possível investir a partir de um banco inativo.')

      const saldoBancoAnterior = Number(banco.saldo_atual)

      if (tipo === 'APORTE') {
        if (valor > saldoBancoAnterior) {
          throw new Error(`Saldo insuficiente em "${banco.nome}". Disponível: R$ ${saldoBancoAnterior.toFixed(2)}.`)
        }
      } else {
        const jaInvestidoNesseBanco = await getSaldoInvestido(usuario.id, banco_id)
        if (valor > jaInvestidoNesseBanco) {
          throw new Error(`Resgate maior que o saldo investido em "${banco.nome}" (R$ ${jaInvestidoNesseBanco.toFixed(2)}).`)
        }
      }

      const delta = tipo === 'APORTE' ? -valor : valor
      const saldoBancoPosterior = Math.round((saldoBancoAnterior + delta) * 100) / 100

      await tx.banco.update({ where: { id: banco.id }, data: { saldo_atual: saldoBancoPosterior } })

      const investimento = await tx.investimento.create({
        data: {
          tipo,
          descricao,
          valor,
          dt_movimento,
          numero_documento,
          banco_id: banco.id,
          saldo_banco_anterior: saldoBancoAnterior,
          saldo_banco_posterior: saldoBancoPosterior,
          usuario_id: usuario.id,
        },
      })

      await tx.movimentacaoBanco.create({
        data: {
          banco_id: banco.id,
          investimento_id: investimento.id,
          tipo: tipo === 'APORTE' ? 'SAIDA' : 'ENTRADA',
          descricao: tipo === 'APORTE' ? `Aporte em investimento — ${descricao}` : `Resgate de investimento — ${descricao}`,
          valor,
          saldo_anterior: saldoBancoAnterior,
          saldo_posterior: saldoBancoPosterior,
          dt_movimento,
        },
      })

      return { ...investimento, banco: { id: banco.id, nome: banco.nome } }
    })

    revalidatePath('/financeiro/investimentos')
    revalidatePath('/financeiro/bancos')
    revalidatePath('/financeiro/balancete')
    return {
      success: true,
      data: {
        ...resultado,
        valor: Number(resultado.valor),
        saldo_banco_anterior: Number(resultado.saldo_banco_anterior),
        saldo_banco_posterior: Number(resultado.saldo_banco_posterior),
      },
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao registrar movimento.'
    return { success: false, error: mensagem }
  }
}

export async function editarInvestimento(id: string, formData: FormData): Promise<ActionResult<InvestimentoComBanco>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const existente = await prisma.investimento.findFirst({ where: { id, usuario_id: usuario.id } })
    if (!existente) return { success: false, error: 'Investimento não encontrado.' }

    const tipo = formData.get('tipo') as TipoInvestimento
    const descricao = (formData.get('descricao') as string)?.trim()
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const dtStr = formData.get('dt_movimento') as string
    const dt_movimento = dtStr ? new Date(`${dtStr}T12:00:00`) : existente.dt_movimento

    if (tipo !== 'APORTE' && tipo !== 'RESGATE') return { success: false, error: 'Tipo inválido.' }
    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }

    // Banco fixo na edição (decisão confirmada): não lê banco_id do form, usa o do registro existente.
    const banco_id = existente.banco_id

    const resultado = await prisma.$transaction(async (tx) => {
      const banco = await tx.banco.findFirst({ where: { id: banco_id, usuario_id: usuario.id } })
      if (!banco) throw new Error('Banco não encontrado.')

      // 1. Estorna o efeito que a versão ATUAL do registro já aplicou no banco.
      const deltaEstorno = existente.tipo === 'APORTE' ? Number(existente.valor) : -Number(existente.valor)
      const saldoAposEstorno = Math.round((Number(banco.saldo_atual) + deltaEstorno) * 100) / 100
      await tx.banco.update({ where: { id: banco.id }, data: { saldo_atual: saldoAposEstorno } })
      await tx.movimentacaoBanco.deleteMany({ where: { investimento_id: id } })

      // 2. Valida e aplica o novo valor/tipo, ignorando este registro na soma do saldo investido.
      if (tipo === 'APORTE') {
        if (valor > saldoAposEstorno) {
          throw new Error(`Saldo insuficiente em "${banco.nome}". Disponível: R$ ${saldoAposEstorno.toFixed(2)}.`)
        }
      } else {
        const jaInvestidoNesseBanco = await getSaldoInvestido(usuario.id, banco_id, id)
        if (valor > jaInvestidoNesseBanco) {
          throw new Error(`Resgate maior que o saldo investido em "${banco.nome}" (R$ ${jaInvestidoNesseBanco.toFixed(2)}).`)
        }
      }

      const delta = tipo === 'APORTE' ? -valor : valor
      const saldoBancoPosterior = Math.round((saldoAposEstorno + delta) * 100) / 100
      await tx.banco.update({ where: { id: banco.id }, data: { saldo_atual: saldoBancoPosterior } })

      const atualizado = await tx.investimento.update({
        where: { id },
        data: {
          tipo,
          descricao,
          valor,
          dt_movimento,
          numero_documento,
          saldo_banco_anterior: saldoAposEstorno,
          saldo_banco_posterior: saldoBancoPosterior,
        },
      })

      await tx.movimentacaoBanco.create({
        data: {
          banco_id: banco.id,
          investimento_id: id,
          tipo: tipo === 'APORTE' ? 'SAIDA' : 'ENTRADA',
          descricao: tipo === 'APORTE' ? `Aporte em investimento — ${descricao}` : `Resgate de investimento — ${descricao}`,
          valor,
          saldo_anterior: saldoAposEstorno,
          saldo_posterior: saldoBancoPosterior,
          dt_movimento,
        },
      })

      return { ...atualizado, banco: { id: banco.id, nome: banco.nome } }
    })

    revalidatePath('/financeiro/investimentos')
    revalidatePath('/financeiro/bancos')
    revalidatePath('/financeiro/balancete')
    return {
      success: true,
      data: {
        ...resultado,
        valor: Number(resultado.valor),
        saldo_banco_anterior: Number(resultado.saldo_banco_anterior),
        saldo_banco_posterior: Number(resultado.saldo_banco_posterior),
      },
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao editar movimento.'
    return { success: false, error: mensagem }
  }
}

export async function excluirInvestimento(id: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Não autenticado.' }

    const investimento = await prisma.investimento.findFirst({ where: { id, usuario_id: usuario.id } })
    if (!investimento) return { success: false, error: 'Investimento não encontrado.' }

    // Excluir um APORTE não pode deixar o saldo investido daquele banco negativo —
    // ou seja, não pode haver resgates "órfãos" sem aporte suficiente por trás.
    if (investimento.tipo === 'APORTE') {
      const saldoSemEsteAporte = await getSaldoInvestido(usuario.id, investimento.banco_id, id)
      if (saldoSemEsteAporte < 0) {
        return { success: false, error: 'Não é possível excluir: existem resgates que dependem deste aporte.' }
      }
    }

    await prisma.$transaction(async (tx) => {
      const banco = await tx.banco.findFirst({ where: { id: investimento.banco_id } })
      if (banco) {
        // Estorno: desfaz o débito/crédito que este investimento causou no banco.
        const delta = investimento.tipo === 'APORTE' ? Number(investimento.valor) : -Number(investimento.valor)
        const novoSaldo = Math.round((Number(banco.saldo_atual) + delta) * 100) / 100
        await tx.banco.update({ where: { id: banco.id }, data: { saldo_atual: novoSaldo } })
      }
      await tx.movimentacaoBanco.deleteMany({ where: { investimento_id: id } })
      await tx.investimento.delete({ where: { id } })
    })

    revalidatePath('/financeiro/investimentos')
    revalidatePath('/financeiro/bancos')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir movimento.' }
  }
}
