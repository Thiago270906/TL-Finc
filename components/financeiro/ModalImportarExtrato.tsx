'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Upload, FileText, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { analisarExtratoPdf, confirmarImportacaoExtrato } from '@/app/actions'
import type { PlanoContas } from '@/types'
import type { PreviaImportacaoExtrato, LinhaPreviaImportacao, LinhaConfirmacaoImportacao, AcaoLinhaImportacao } from '@/lib/extrato/tipos'

interface Props {
  bancoId: string
  bancoNome: string
  planoContas: PlanoContas[]
  onClose: () => void
  onImportado: (saldo_atual: number) => void
}

// Deve ficar abaixo do limite configurado em next.config.ts (experimental.serverActions.bodySizeLimit).
const TAMANHO_MAXIMO_BYTES = 9 * 1024 * 1024

type LinhaEditavel = LinhaPreviaImportacao & {
  acao: AcaoLinhaImportacao
  planoContasId: string | null
  lancamentoConciliadoId: string | null
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarDataCurta(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default function ModalImportarExtrato({ bancoId, bancoNome, planoContas, onClose, onImportado }: Props) {
  const [fase, setFase] = useState<'upload' | 'revisao'>('upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [previa, setPrevia] = useState<PreviaImportacaoExtrato | null>(null)
  const [linhas, setLinhas] = useState<LinhaEditavel[]>([])

  async function handleAnalisar() {
    if (!arquivo) { toast.error('Selecione o arquivo PDF do extrato.'); return }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      toast.error(`Arquivo muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)} MB). O limite é de ${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB.`)
      return
    }
    setAnalisando(true)
    try {
      const formData = new FormData()
      formData.set('arquivo', arquivo)

      const resultado = await analisarExtratoPdf(bancoId, formData)
      if (!resultado.success) { toast.error(resultado.error); return }

      setPrevia(resultado.data)
      setLinhas(resultado.data.linhas.map(l => ({
        ...l,
        acao: l.possivelDuplicata ? 'IGNORAR' : l.acaoSugerida,
        planoContasId: l.planoContasSugeridoId,
        lancamentoConciliadoId: l.lancamentoConciliadoId,
      })))
      setFase('revisao')
    } catch (erro) {
      console.error('Erro ao analisar extrato:', erro)
      const detalhe = erro instanceof Error ? erro.message : String(erro)
      toast.error(`Não foi possível analisar o extrato. ${detalhe}`)
    } finally {
      setAnalisando(false)
    }
  }

  function atualizarLinha(chave: string, patch: Partial<LinhaEditavel>) {
    setLinhas(prev => prev.map(l => l.chave === chave ? { ...l, ...patch } : l))
  }

  const linhasPendentesSemCategoria = linhas.some(l => l.acao === 'CRIAR' && !l.planoContasId)
  const totalCriar = linhas.filter(l => l.acao === 'CRIAR').length
  const totalConciliar = linhas.filter(l => l.acao === 'CONCILIAR').length
  const totalIgnorar = linhas.filter(l => l.acao === 'IGNORAR').length

  async function handleConfirmar() {
    if (linhasPendentesSemCategoria) { toast.error('Selecione a categoria de todas as linhas marcadas para criar.'); return }
    setConfirmando(true)
    try {
      const payload: LinhaConfirmacaoImportacao[] = linhas.map(l => ({
        chave: l.chave,
        data: l.data,
        descricao: l.descricao,
        beneficiario: l.beneficiario,
        valor: l.valor,
        tipoMovimento: l.tipoMovimento,
        acao: l.acao,
        lancamentoConciliadoId: l.acao === 'CONCILIAR' ? l.lancamentoConciliadoId : null,
        planoContasId: l.acao === 'CRIAR' ? l.planoContasId : null,
      }))

      const resultado = await confirmarImportacaoExtrato(bancoId, payload)
      if (!resultado.success) { toast.error(resultado.error); return }

      toast.success(`Importação concluída: ${resultado.data.criados} lançamento(s) criado(s), ${resultado.data.conciliados} conciliado(s).`)
      onImportado(resultado.data.saldo_atual)
      onClose()
    } catch (erro) {
      console.error('Erro ao confirmar importação:', erro)
      toast.error('Não foi possível concluir a importação. Verifique sua conexão e tente novamente.')
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-lg font-bold">Importar extrato — {bancoNome}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Envie o PDF do extrato para identificar e lançar as movimentações automaticamente.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {fase === 'upload' && (
          <div className="p-6 space-y-4">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 cursor-pointer hover:border-gray-500 transition-colors text-center">
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-300">
                {arquivo ? arquivo.name : 'Clique para selecionar o PDF do extrato'}
              </span>
              <span className="text-xs text-gray-500">Funciona com extratos de diferentes bancos.</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAnalisar}
                disabled={!arquivo || analisando}
                className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {analisando ? 'Analisando extrato...' : 'Analisar extrato'}
              </button>
            </div>
          </div>
        )}

        {fase === 'revisao' && previa && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-3 py-1.5 text-gray-300">
                <FileText size={14} /> {previa.bancoDetectado}
              </span>
              <span className="bg-background border border-border rounded-lg px-3 py-1.5 text-emerald-400">
                {linhas.length} transaçõe(s) encontradas
              </span>
              <span className="bg-background border border-border rounded-lg px-3 py-1.5 text-gray-400">
                {totalCriar} novo(s) · {totalConciliar} conciliar · {totalIgnorar} ignorado(s)
              </span>
            </div>

            {previa.layoutGenerico && (
              <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                Não reconhecemos com certeza o layout deste banco — confira valores e descrições antes de confirmar.
              </div>
            )}

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Data</th>
                      <th className="text-left px-3 py-2">Descrição</th>
                      <th className="text-right px-3 py-2">Valor</th>
                      <th className="text-left px-3 py-2">Ação</th>
                      <th className="text-left px-3 py-2">Categoria / Vínculo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {linhas.map(l => (
                      <tr key={l.chave} className={l.possivelDuplicata ? 'bg-yellow-500/5' : undefined}>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap align-top">{formatarDataCurta(l.data)}</td>
                        <td className="px-3 py-2 align-top max-w-[220px]">
                          <div className="flex items-start gap-1.5">
                            {l.tipoMovimento === 'ENTRADA'
                              ? <ArrowUpCircle size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                              : <ArrowDownCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                            <div className="min-w-0">
                              <p className="text-foreground truncate" title={l.descricao}>{l.beneficiario ?? l.descricao}</p>
                              {l.possivelDuplicata && (
                                <p className="text-[11px] text-yellow-400 mt-0.5">Parece já ter sido importada</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap align-top ${l.tipoMovimento === 'SAIDA' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {l.tipoMovimento === 'SAIDA' ? '-' : '+'}{formatarMoeda(l.valor)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            value={l.acao}
                            onChange={e => atualizarLinha(l.chave, { acao: e.target.value as AcaoLinhaImportacao })}
                            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-hover"
                          >
                            <option value="CRIAR">Criar lançamento</option>
                            {l.candidatosConciliacao.length > 0 && <option value="CONCILIAR">Conciliar pendente</option>}
                            <option value="IGNORAR">Ignorar</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top min-w-[200px]">
                          {l.acao === 'CRIAR' && (
                            <select
                              value={l.planoContasId ?? ''}
                              onChange={e => atualizarLinha(l.chave, { planoContasId: e.target.value || null })}
                              className={`w-full bg-background border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-hover ${!l.planoContasId ? 'border-red-500/60' : 'border-border'}`}
                            >
                              <option value="">Selecione a categoria...</option>
                              {planoContas
                                .filter(p => p.tipo === (l.tipoMovimento === 'ENTRADA' ? 'RECEITA' : 'DESPESA'))
                                .map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                          )}
                          {l.acao === 'CONCILIAR' && (
                            <select
                              value={l.lancamentoConciliadoId ?? ''}
                              onChange={e => atualizarLinha(l.chave, { lancamentoConciliadoId: e.target.value || null })}
                              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-hover"
                            >
                              {l.candidatosConciliacao.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.descricao} — {formatarMoeda(c.valor)} (venc. {formatarDataCurta(c.dt_vencimento)})
                                </option>
                              ))}
                            </select>
                          )}
                          {l.acao === 'IGNORAR' && <span className="text-xs text-gray-500">Não será importado</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setFase('upload')} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={confirmando || linhasPendentesSemCategoria || (totalCriar + totalConciliar === 0)}
                className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {confirmando ? 'Importando...' : `Confirmar importação (${totalCriar + totalConciliar})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
