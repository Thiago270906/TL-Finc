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

// --- Padrão E: Nubank — ex: "01 OUT 2026 Total de entradas + 1.470,00" seguido de
// "Transferência recebida pelo Pix FULANO ... 1.470,00". A data (dia + mês abreviado
// em maiúsculas + ano) só aparece na primeira linha de cada dia, e cada bloco de
// movimentações começa com um cabeçalho de seção "Total de entradas"/"Total de
// saídas" que define o tipo (entrada/saída) de todas as linhas seguintes até o
// próximo cabeçalho — a própria linha da transação não traz sinal nem letra D/C.
// A descrição pode quebrar em várias linhas, e o texto de rodapé/cabeçalho que se
// repete a cada página (SAC, nome do titular, CPF, período) entra no meio do fluxo
// de texto extraído do PDF e precisa ser ignorado.
function extrairPadraoNubank(textoOriginal: string): TransacaoExtrato[] {
  const MESES_PT: Record<string, number> = {
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  }
  const RE_LINHA_DATA = /^(\d{1,2})\s+([A-ZÇÃÁÀÂÉÊÍÓÔÕÚ]{3})\s+(\d{4})\s*(.*)$/i
  const RE_TOTAL_SECAO = new RegExp(`^total de (entradas|sa[ií]das)\\s*([+-])\\s*${RE_VALOR.source}\\s*$`, 'i')
  const RE_VALOR_NO_FIM = new RegExp(`(${RE_VALOR.source})\\s*$`)
  const RE_INICIO_RODAPE = /^tem alguma d[uú]vida/i
  const RE_FIM_RODAPE = /de \d{4}.*valores em r\$/i

  const idxInicio = textoOriginal.split(/\r?\n/).findIndex(l => /^movimenta[cç][oõ]es/i.test(l.trim()))
  if (idxInicio === -1) return []

  const transacoes: TransacaoExtrato[] = []
  let dataAtual: Date | null = null
  let tipoAtual: TransacaoExtrato['tipo'] | null = null
  let bufferDescricao: string[] = []
  let dentroRodape = false

  const linhas = textoOriginal.split(/\r?\n/).slice(idxInicio + 1)
  for (const linhaBruta of linhas) {
    const linhaOriginal = linhaBruta.trim()
    if (!linhaOriginal) continue

    if (RE_INICIO_RODAPE.test(linhaOriginal)) {
      dentroRodape = true
      bufferDescricao = []
      continue
    }
    if (dentroRodape) {
      if (RE_FIM_RODAPE.test(linhaOriginal)) dentroRodape = false
      continue
    }

    let linha = linhaOriginal
    const comData = RE_LINHA_DATA.exec(linha)
    if (comData) {
      const mes = MESES_PT[comData[2].toLowerCase()]
      if (mes !== undefined) {
        dataAtual = new Date(Number(comData[3]), mes, Number(comData[1]))
        bufferDescricao = []
        linha = comData[4].trim()
        if (!linha) continue
      }
    }

    if (RE_TOTAL_SECAO.test(linha)) {
      tipoAtual = /entrada/i.test(linha) ? 'ENTRADA' : 'SAIDA'
      bufferDescricao = []
      continue
    }

    const valorMatch = RE_VALOR_NO_FIM.exec(linha)
    if (!valorMatch) {
      bufferDescricao.push(linha)
      continue
    }

    const descRestante = linha.slice(0, valorMatch.index).trim()
    const descricao = limparDescricao([...bufferDescricao, descRestante].filter(Boolean).join(' '))
    bufferDescricao = []

    if (!descricao || !dataAtual || !tipoAtual) continue

    transacoes.push({
      data: dataAtual,
      descricao,
      valor: parseValorBR(valorMatch[1]),
      tipo: tipoAtual,
    })
  }

  return transacoes
}

function detectarNomeBanco(textoOriginal: string): string | null {
  const t = textoOriginal.toLowerCase()

  // Padrões fortes: só aparecem quando o extrato é realmente desse banco (razão
  // social/domínio institucional do rodapé) — evitam falso positivo quando o nome
  // de outro banco aparece apenas como contraparte de uma transferência Pix (ex:
  // extrato do Nubank com um Pix recebido via "BCO BRADESCO S.A." seria detectado
  // como Bradesco se usássemos só a lista de substrings fracos abaixo).
  const bancosFortes: [string, string][] = [
    ['nu pagamentos s.a', 'Nubank'],
    ['nu financeira s.a', 'Nubank'],
    ['nubank.com.br', 'Nubank'],
  ]
  for (const [chave, nome] of bancosFortes) {
    if (t.includes(chave)) return nome
  }

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
    { transacoes: extrairPadraoNubank(textoOriginal), generico: true },
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
