// =============================================================================
// ENUMS
// Espelham exatamente os enums do schema Prisma
// =============================================================================

export type Recorrencia = 'NAO' | 'DIARIAMENTE' | 'SEMANALMENTE' | 'MENSALMENTE'

// =============================================================================
// TIPOS BASE
// Espelham os campos das tabelas do banco, sem relações
// =============================================================================

export type Usuario = {
  id: string
  nome: string
  email: string
  ativo: boolean
  imagem: string | null
  dt_insert: Date | string
  dt_update: Date | string
  // senha nunca é incluída nos tipos de retorno
}

// =============================================================================
// RETORNO PADRÃO DAS SERVER ACTIONS
// =============================================================================

export type ActionResult<T = undefined> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string }

// =============================================================================
// MÓDULO FINANCEIRO
// =============================================================================

export type TipoLancamento = 'DESPESA' | 'RECEITA'

export type StatusLancamento = 'PENDENTE' | 'PAGO' | 'CANCELADO'

export type PlanoContas = {
  id: string
  tipo: TipoLancamento
  nome: string
  ativo: boolean
  dt_insert: Date | string
  dt_update: Date | string
}

export type LancamentoFinanceiro = {
  id: string
  tipo: TipoLancamento
  descricao: string
  beneficiario: string | null
  valor: number
  dt_vencimento: Date | string
  dt_pagamento: Date | string | null
  numero_documento: string | null
  plano_contas_id: string
  status: StatusLancamento
  recorrencia: Recorrencia
  numero_parcelas: number | null
  parcela_atual: number | null
  grupo_parcela_id: string | null
  lancamento_pai_id: string | null
  dt_insert: Date | string
  dt_update: Date | string
}

export type AnexoFinanceiro = {
  id: string
  lancamento_id: string
  nome: string
  url: string
  key: string
  tamanho: number
  dt_upload: Date | string
}

export type PagamentoParcial = {
  id: string
  lancamento_id: string
  valor: number
  dt_pagamento: Date | string
  observacao: string | null
  dt_insert: Date | string
}

export type LancamentoComRelacoes = LancamentoFinanceiro & {
  plano_contas: PlanoContas
  anexos: AnexoFinanceiro[]
  parciais: PagamentoParcial[]
  parcelas?: LancamentoFinanceiro[]
}

export type ItemBalanceteConta = {
  plano_contas_id: string
  nome: string
  total: number
}

export type DadosMensaisBalancete = {
  mes: string
  receitas: number
  despesas: number
  lucro: number
}

export type ContratoEncerrando = {
  id: string
  descricao: string
  valor: number
  dt_ultima_parcela: string
  dias_restantes: number
  parcelas_restantes: number
  total_parcelas: number
}

export type Balancete = {
  receitas: number
  despesas: number
  lucro: number
  saldo: number
  a_receber: number
  a_pagar: number
  receitas_por_conta: ItemBalanceteConta[]
  despesas_por_conta: ItemBalanceteConta[]
  dados_mensais: DadosMensaisBalancete[]
  contratos_encerrando: ContratoEncerrando[]
  lancamentos_por_conta: Record<string, { descricao: string; valor: number; status: string; dt_vencimento: Date }[]>
}
