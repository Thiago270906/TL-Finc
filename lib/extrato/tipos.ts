// =============================================================================
// IMPORTAÇÃO INTELIGENTE DE EXTRATOS BANCÁRIOS (PDF)
// =============================================================================

export type TipoMovimentoExtrato = 'ENTRADA' | 'SAIDA'

export type TransacaoExtrato = {
  data: Date
  descricao: string
  valor: number // sempre positivo
  tipo: TipoMovimentoExtrato
}

export type ExtratoParseado = {
  bancoDetectado: string
  layoutGenerico: boolean
  transacoes: TransacaoExtrato[]
}

export type AcaoLinhaImportacao = 'CRIAR' | 'CONCILIAR' | 'IGNORAR'

export type CandidatoConciliacao = {
  id: string
  descricao: string
  valor: number
  dt_vencimento: string
}

export type LinhaPreviaImportacao = {
  chave: string
  data: string // ISO yyyy-mm-dd
  descricao: string
  beneficiario: string | null
  valor: number
  tipoMovimento: TipoMovimentoExtrato
  acaoSugerida: AcaoLinhaImportacao
  lancamentoConciliadoId: string | null
  candidatosConciliacao: CandidatoConciliacao[]
  planoContasSugeridoId: string | null
  possivelDuplicata: boolean
}

export type PreviaImportacaoExtrato = {
  bancoDetectado: string
  layoutGenerico: boolean
  totalEntradas: number
  totalSaidas: number
  linhas: LinhaPreviaImportacao[]
}

export type LinhaConfirmacaoImportacao = {
  chave: string
  data: string
  descricao: string
  beneficiario: string | null
  valor: number
  tipoMovimento: TipoMovimentoExtrato
  acao: AcaoLinhaImportacao
  lancamentoConciliadoId: string | null
  planoContasId: string | null
}
