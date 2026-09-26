import { prisma } from '@/lib/prisma'
import type { ActionResult } from '@/types'
import { extrairTextoPdf } from '@/lib/extrato/extrairTextoPdf'
import { parsearExtratoPdf } from '@/lib/extrato/parser'
import { extrairBeneficiario, sugerirPlanoContas } from '@/lib/extrato/classificar'
import { encontrarCandidatosConciliacao, pareceDuplicata } from '@/lib/extrato/conciliar'
import type { PreviaImportacaoExtrato, LinhaPreviaImportacao } from '@/lib/extrato/tipos'

export async function analisarExtratoPdf(
  bancoId: string,
  arquivo: File,
  usuarioId: string
): Promise<ActionResult<PreviaImportacaoExtrato>> {
  try {
    const banco = await prisma.banco.findFirst({ where: { id: bancoId, usuario_id: usuarioId } })
    if (!banco) return { success: false, error: 'Banco não encontrado.' }

    if (!arquivo || arquivo.size === 0) return { success: false, error: 'Selecione um arquivo PDF.' }

    const buffer = Buffer.from(await arquivo.arrayBuffer())
    // Valida pelo conteúdo (assinatura "%PDF-"), não por nome/MIME informados pelo navegador —
    // em alguns fluxos de upload no Android esses metadados chegam incompletos ou incorretos.
    if (!buffer.subarray(0, 1024).includes('%PDF-')) {
      return { success: false, error: 'Apenas arquivos PDF são suportados.' }
    }

    const texto = await extrairTextoPdf(buffer)
    const { bancoDetectado, layoutGenerico, transacoes } = parsearExtratoPdf(texto)

    if (transacoes.length === 0) {
      return { success: false, error: 'Não foi possível reconhecer transações neste PDF. Confira se o arquivo é um extrato de conta corrente.' }
    }

    const datasMs = transacoes.map(t => t.data.getTime())
    const dataMin = new Date(Math.min(...datasMs) - 5 * 86400000)
    const dataMax = new Date(Math.max(...datasMs) + 5 * 86400000)

    const [planosContas, pendentes, movimentacoesExistentes] = await Promise.all([
      prisma.planoContas.findMany({ where: { ativo: true, usuario_id: usuarioId }, orderBy: { nome: 'asc' } }),
      prisma.lancamentoFinanceiro.findMany({
        where: { status: 'PENDENTE', dt_vencimento: { gte: dataMin, lte: dataMax }, usuario_id: usuarioId },
        select: { id: true, tipo: true, valor: true, dt_vencimento: true, descricao: true },
      }),
      prisma.movimentacaoBanco.findMany({
        where: { banco_id: bancoId, dt_movimento: { gte: dataMin, lte: dataMax } },
        select: { tipo: true, valor: true, dt_movimento: true },
      }),
    ])

    const pendentesMinimos = pendentes.map(l => ({ ...l, valor: Number(l.valor) }))
    const movimentacoesMinimas = movimentacoesExistentes.map(m => ({ ...m, valor: Number(m.valor) }))

    const jaUsados = new Set<string>()
    let totalEntradas = 0
    let totalSaidas = 0

    const linhas: LinhaPreviaImportacao[] = transacoes.map((t, i) => {
      if (t.tipo === 'ENTRADA') totalEntradas += t.valor
      else totalSaidas += t.valor

      const candidatos = encontrarCandidatosConciliacao(t, pendentesMinimos, jaUsados)
      const melhorCandidato = candidatos[0] ?? null
      if (melhorCandidato) jaUsados.add(melhorCandidato.id)

      return {
        chave: `${i}-${t.data.getTime()}-${t.valor}`,
        data: t.data.toISOString().split('T')[0],
        descricao: t.descricao,
        beneficiario: extrairBeneficiario(t.descricao),
        valor: t.valor,
        tipoMovimento: t.tipo,
        acaoSugerida: melhorCandidato ? 'CONCILIAR' : 'CRIAR',
        lancamentoConciliadoId: melhorCandidato?.id ?? null,
        candidatosConciliacao: candidatos.map(c => ({
          id: c.id,
          descricao: c.descricao,
          valor: c.valor,
          dt_vencimento: new Date(c.dt_vencimento).toISOString().split('T')[0],
        })),
        planoContasSugeridoId: sugerirPlanoContas(t.descricao, t.tipo, planosContas),
        possivelDuplicata: pareceDuplicata(t, movimentacoesMinimas),
      }
    })

    return { success: true, data: { bancoDetectado, layoutGenerico, totalEntradas, totalSaidas, linhas } }
  } catch (erro) {
    console.error('Erro ao analisar extrato PDF:', erro)
    return { success: false, error: 'Erro ao processar o PDF do extrato.' }
  }
}
