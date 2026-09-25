import type { PlanoContas } from '@/types'
import type { TipoMovimentoExtrato } from './tipos'

// =============================================================================
// SUGESTÃO DE BENEFICIÁRIO E CATEGORIA (PLANO DE CONTAS) A PARTIR DA DESCRIÇÃO
//
// As regras usam termos padronizados que os bancos brasileiros costumam usar
// nas descrições de extrato (PIX, TED, TARIFA, CARTÃO...), então tendem a
// generalizar razoavelmente entre instituições diferentes — não dependem de
// um banco específico.
// =============================================================================

const PREFIXOS_DESCRICAO = [
  /^pagamento\s+pix\s*-\s*/i,
  /^recebimento\s+pix\s*-\s*/i,
  /^transfer[êe]ncia\s*-\s*/i,
  /^ted\s*-\s*/i,
  /^doc\s*-\s*/i,
  /^cart[aã]o\s+d[ée]bito\s*-\s*/i,
  /^cart[aã]o\s+cr[ée]dito\s*-\s*/i,
  /^passagem\s+ped[aá]gio\s*-\s*/i,
  /^compra\s*-\s*/i,
]

export function extrairBeneficiario(descricao: string): string | null {
  let texto = descricao
  for (const re of PREFIXOS_DESCRICAO) texto = texto.replace(re, '')
  texto = texto.replace(/^\d{10,14}\s+/, '') // CPF/CNPJ solto no início
  texto = texto.replace(/\s*-\s*BR$/i, '')
  texto = texto.trim()
  return texto.length > 0 ? texto : null
}

type RegraCategoria = { palavras: string[]; categorias: string[] }

const REGRAS_ENTRADA: RegraCategoria[] = [
  { palavras: ['pix'], categorias: ['pix', 'recebiment', 'venda', 'honorario'] },
  { palavras: ['ted', 'doc', 'transfer'], categorias: ['transfer', 'recebiment'] },
  { palavras: ['integraliza', 'capital'], categorias: ['capital', 'socio'] },
]

const REGRAS_SAIDA: RegraCategoria[] = [
  { palavras: ['cartao debito', 'cartao credito', 'compra'], categorias: ['cart', 'aliment', 'combust', 'despesa'] },
  { palavras: ['pix'], categorias: ['pix', 'pagamento', 'fornecedor'] },
  { palavras: ['ted', 'doc', 'transfer'], categorias: ['transfer'] },
  { palavras: ['tarifa'], categorias: ['tarifa', 'banc'] },
  { palavras: ['pedagio'], categorias: ['pedagio', 'transporte', 'viagem'] },
  { palavras: ['integraliza', 'capital'], categorias: ['capital', 'socio'] },
]

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function sugerirPlanoContas(
  descricao: string,
  tipoMovimento: TipoMovimentoExtrato,
  planosContas: PlanoContas[]
): string | null {
  const tipoLancamento = tipoMovimento === 'ENTRADA' ? 'RECEITA' : 'DESPESA'
  const disponiveis = planosContas.filter(p => p.ativo && p.tipo === tipoLancamento)
  if (disponiveis.length === 0) return null

  const descNorm = normalizar(descricao)
  const regras = tipoMovimento === 'ENTRADA' ? REGRAS_ENTRADA : REGRAS_SAIDA

  for (const regra of regras) {
    if (!regra.palavras.some(p => descNorm.includes(p))) continue
    const encontrada = disponiveis.find(p => regra.categorias.some(c => normalizar(p.nome).includes(c)))
    if (encontrada) return encontrada.id
  }
  return null
}
