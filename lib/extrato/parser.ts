import type { ExtratoParseado, TransacaoExtrato } from './tipos'

// =============================================================================
// PARSER DE EXTRATOS BANCÁRIOS (PDF → texto → transações)
//
// A maioria dos extratos de bancos/cooperativas brasileiros, quando exportados
// em PDF, gera o texto em ordem de leitura (linha a linha, não coluna a coluna),
// então conseguimos reconhecer as transações com padrões de texto em vez de
// depender de um layout fixo por banco. Damos nomes amigáveis pra alguns bancos
// conhecidos, mas os padrões abaixo não são exclusivos do Sicredi — tendem a
// funcionar em qualquer extrato que siga um desses três formatos comuns.
// =============================================================================

const RE_DATA = /\d{2}\/\d{2}\/\d{4}/
const RE_VALOR = /[\d]{1,3}(?:\.\d{3})*,\d{2}/

function normalizarTexto(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

function parseValorBR(str: string): number {
  return Number(str.replace(/\./g, '').replace(',', '.'))
}

function parseDataBR(str: string): Date {
  const [dia, mes, ano] = str.split('/').map(Number)
  return new Date(ano, mes - 1, dia)
}

function limparDescricao(desc: string): string {
  return desc.replace(/\s+/g, ' ').replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim()
}

// --- Padrão A: sinal antes do "R$" — ex: "+ R$ 425,80" / "- R$ 137,50" ---
function extrairPadraoSinalAntesDeRS(textoFlat: string): TransacaoExtrato[] {
  const re = new RegExp(
    `(${RE_DATA.source})\\s+((?:(?!${RE_DATA.source}).)*?)\\s*([+-])\\s*R\\$\\s*(${RE_VALOR.source})`,
    'g'
  )
  const transacoes: TransacaoExtrato[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(textoFlat))) {
    const [, dataStr, descRaw, sinal, valorStr] = m
    const descricao = limparDescricao(descRaw)
    if (!descricao) continue
    transacoes.push({
      data: parseDataBR(dataStr),
      descricao,
      valor: parseValorBR(valorStr),
      tipo: sinal === '+' ? 'ENTRADA' : 'SAIDA',
    })
  }
  return transacoes
}

// --- Padrão B: valor seguido de sufixo D/C — ex: "150,00 D" / "200,00 C" ---
function extrairPadraoSufixoDC(textoFlat: string): TransacaoExtrato[] {
  const re = new RegExp(
    `(${RE_DATA.source})\\s+((?:(?!${RE_DATA.source}).)*?)\\s*(${RE_VALOR.source})\\s*([DC])\\b`,
    'g'
  )
  const transacoes: TransacaoExtrato[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(textoFlat))) {
    const [, dataStr, descRaw, valorStr, letra] = m
    const descricao = limparDescricao(descRaw.replace(/R\$\s*$/i, ''))
    if (!descricao) continue
    transacoes.push({
      data: parseDataBR(dataStr),
      descricao,
      valor: parseValorBR(valorStr),
      tipo: letra.toUpperCase() === 'C' ? 'ENTRADA' : 'SAIDA',
    })
  }
  return transacoes
}

// --- Padrão C: sinal de menos direto no número, sem "R$" — ex: "-150,00" / "150,00" ---
function extrairPadraoSinalNoNumero(textoFlat: string): TransacaoExtrato[] {
  const re = new RegExp(
    `(${RE_DATA.source})\\s+((?:(?!${RE_DATA.source}).)*?)\\s*(-)?(${RE_VALOR.source})(-)?(?=\\s+(?:${RE_DATA.source})|\\s*$)`,
    'g'
  )
  const transacoes: TransacaoExtrato[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(textoFlat))) {
    const [, dataStr, descRaw, sinalAntes, valorStr, sinalDepois] = m
    const descricao = limparDescricao(descRaw.replace(/R\$\s*$/i, ''))
    if (!descricao) continue
    transacoes.push({
      data: parseDataBR(dataStr),
      descricao,
      valor: parseValorBR(valorStr),
      tipo: sinalAntes || sinalDepois ? 'SAIDA' : 'ENTRADA',
    })
  }
  return transacoes
}

function detectarNomeBanco(textoOriginal: string): string | null {
  const t = textoOriginal.toLowerCase()
  const bancos: [string, string][] = [
    ['sicredi', 'Sicredi'],
    ['sicoob', 'Sicoob'],
    ['itaú', 'Itaú'],
    ['itau', 'Itaú'],
    ['bradesco', 'Bradesco'],
    ['banco do brasil', 'Banco do Brasil'],
    ['caixa econ', 'Caixa Econômica Federal'],
    ['santander', 'Santander'],
    ['nubank', 'Nubank'],
    ['banco inter', 'Banco Inter'],
    ['c6 bank', 'C6 Bank'],
    ['banco original', 'Banco Original'],
    ['btg pactual', 'BTG Pactual'],
    ['banco safra', 'Safra'],
  ]
  for (const [chave, nome] of bancos) {
    if (t.includes(chave)) return nome
  }
  return null
}

export function parsearExtratoPdf(textoOriginal: string): ExtratoParseado {
  const textoFlat = normalizarTexto(textoOriginal)
  const nomeBanco = detectarNomeBanco(textoOriginal)

  const estrategias: { transacoes: TransacaoExtrato[]; generico: boolean }[] = [
    { transacoes: extrairPadraoSinalAntesDeRS(textoFlat), generico: nomeBanco === null },
    { transacoes: extrairPadraoSufixoDC(textoFlat), generico: true },
    { transacoes: extrairPadraoSinalNoNumero(textoFlat), generico: true },
  ]

  let melhor = estrategias[0]
  for (const estrategia of estrategias) {
    if (estrategia.transacoes.length > melhor.transacoes.length) melhor = estrategia
  }

  return {
    bancoDetectado: nomeBanco ?? 'Banco não identificado (layout genérico)',
    layoutGenerico: melhor.generico,
    transacoes: melhor.transacoes,
  }
}
