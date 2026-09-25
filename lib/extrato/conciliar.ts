import type { TransacaoExtrato } from './tipos'

// =============================================================================
// CONCILIAÇÃO — casa cada transação do extrato com um lançamento PENDENTE
// já cadastrado (mesmo valor, data próxima) e detecta possíveis reimportações
// da mesma transação (evita duplicar lançamentos ao reimportar o mesmo extrato).
// =============================================================================

export type LancamentoPendenteMinimo = {
  id: string
  tipo: 'RECEITA' | 'DESPESA'
  valor: number
  dt_vencimento: Date | string
  descricao: string
}

export type MovimentacaoMinima = {
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE_INICIAL'
  valor: number
  dt_movimento: Date | string
}

const TOLERANCIA_DIAS = 5
const TOLERANCIA_VALOR = 0.01

export function encontrarCandidatosConciliacao(
  transacao: TransacaoExtrato,
  pendentes: LancamentoPendenteMinimo[],
  jaUsados: Set<string>
): LancamentoPendenteMinimo[] {
  const tipoEsperado = transacao.tipo === 'ENTRADA' ? 'RECEITA' : 'DESPESA'

  return pendentes
    .filter(l => !jaUsados.has(l.id))
    .filter(l => l.tipo === tipoEsperado)
    .filter(l => Math.abs(l.valor - transacao.valor) <= TOLERANCIA_VALOR)
    .map(l => ({ lancamento: l, diffDias: Math.abs((new Date(l.dt_vencimento).getTime() - transacao.data.getTime()) / 86400000) }))
    .filter(x => x.diffDias <= TOLERANCIA_DIAS)
    .sort((a, b) => a.diffDias - b.diffDias)
    .map(x => x.lancamento)
}

export function pareceDuplicata(transacao: TransacaoExtrato, movimentacoesExistentes: MovimentacaoMinima[]): boolean {
  return movimentacoesExistentes.some(m => {
    const mesmoTipo = m.tipo === transacao.tipo
    const mesmoValor = Math.abs(m.valor - transacao.valor) <= TOLERANCIA_VALOR
    const diffDias = Math.abs((new Date(m.dt_movimento).getTime() - transacao.data.getTime()) / 86400000)
    return mesmoTipo && mesmoValor && diffDias <= 1
  })
}
