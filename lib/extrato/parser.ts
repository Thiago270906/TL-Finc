import type { ExtratoParseado, TransacaoExtrato } from './tipos'

// =============================================================================
// PARSER DE EXTRATOS BANCÁRIOS (PDF → texto → transações)
//
// A maioria dos extratos de bancos/cooperativas brasileiros, quando exportados
// em PDF, gera o texto em ordem de leitura (linha a linha, não coluna a coluna),
// então conseguimos reconhecer as transações com padrões de texto em vez de
// depender de um layout fixo por banco. Damos nomes amigáveis pra alguns bancos
// conhecidos, mas os padrões abaixo não são exclusivos de um banco só — tendem
// a funcionar em qualquer extrato que siga um desses formatos comuns.
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

// --- Padrão D: saldo corrido — ex. Bradesco: tabela "Data | Histórico | Docto. |
// Crédito (R$) | Débito (R$) | Saldo (R$)". Não existe sinal nem letra D/C: cada
// linha traz só um valor seguido do saldo acumulado, e é preciso comparar com o
// saldo da linha anterior para saber se foi entrada ou saída. A data só aparece
// na primeira linha de cada dia, e a descrição pode vir quebrada em 2-3 linhas
// (ex.: "PIX RECEBIDO" numa linha, "REM: Fulano 06/10 123456 500,00 897,09" na
// seguinte) — por isso esse padrão trabalha linha a linha, e não no texto achatado
// usado pelos outros padrões.
function extrairPadraoSaldoCorrido(textoOriginal: string): TransacaoExtrato[] {
  const RE_LINHA_COM_DATA = /^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/
  const RE_VALOR_E_SALDO_NO_FIM = new RegExp(`^(.*\\S)\\s+(${RE_VALOR.source})\\s+(${RE_VALOR.source})\\s*$`)
  const RE_SALDO_NO_FIM = new RegExp(`(${RE_VALOR.source})\\s*$`)
  const RE_IGNORAR = /\(r\$\)|^extrato de:|^data:|^nome:|^total\b|^bradesco|^folha\b/i
  const RE_MARCADOR_SALDO = /^cod\.?\s*lanc/i

  const transacoes: TransacaoExtrato[] = []
  let dataAtual: Date | null = null
  let saldoAnterior: number | null = null
  let bufferDescricao: string[] = []

  for (const linhaBruta of textoOriginal.split(/\r?\n/)) {
    let linha = linhaBruta.trim()
    if (!linha) continue

    const comData = RE_LINHA_COM_DATA.exec(linha)
    if (comData) {
      dataAtual = parseDataBR(comData[1])
      linha = comData[2].trim()
      if (!linha) continue
    }

    if (RE_IGNORAR.test(linha)) {
      bufferDescricao = []
      continue
    }

    if (RE_MARCADOR_SALDO.test(linha)) {
      const m = RE_SALDO_NO_FIM.exec(linha)
      if (m) saldoAnterior = parseValorBR(m[1])
      bufferDescricao = []
      continue
    }

    const m = RE_VALOR_E_SALDO_NO_FIM.exec(linha)
    if (!m) {
      bufferDescricao.push(linha)
      continue
    }

    const [, descRestante, valorStr, saldoStr] = m
    const valor = parseValorBR(valorStr)
    const saldo = parseValorBR(saldoStr)

    const descricaoLimpa = descRestante
      .replace(/\s+\d{2}\/\d{2}\s+\S+$/, '') // remove " dd/mm docto" no final
      .replace(/\s+\d{4,}$/, '') // remove docto solto no final
      .trim()

    const descricao = limparDescricao([...bufferDescricao, descricaoLimpa].filter(Boolean).join(' '))
    bufferDescricao = []

    if (!descricao || !dataAtual) continue
    if (saldoAnterior === null) saldoAnterior = saldo - valor

    transacoes.push({
      data: dataAtual,
      descricao,
      valor,
      tipo: saldo >= saldoAnterior ? 'ENTRADA' : 'SAIDA',
    })
    saldoAnterior = saldo
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
    { transacoes: extrairPadraoSaldoCorrido(textoOriginal), generico: true },
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
