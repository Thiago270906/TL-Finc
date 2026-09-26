'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, X, Landmark, Power, ArrowDownCircle, ArrowUpCircle, CircleDot, Upload, ArrowLeftRight } from 'lucide-react'
import { criarBanco, toggleAtivoBanco, excluirBanco, getExtratoBanco, transferirEntreContas, getTransferencias } from '@/app/actions'
import BotaoDeletar from '@/components/BotaoDeletar'
import ModalImportarExtrato from '@/components/financeiro/ModalImportarExtrato'
import type { Banco, MovimentacaoBanco, PlanoContas } from '@/types'

type Transferencia = MovimentacaoBanco & { banco: { nome: string } }

interface Props {
  bancos: Banco[]
  planoContas: PlanoContas[]
  transferencias: Transferencia[]
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarMoedaCentavos(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleString('pt-BR')
}

export default function BancosView({ bancos: inicial, planoContas, transferencias: transferenciasIniciais }: Props) {
  const [bancos, setBancos] = useState(inicial)
  const [transferencias, setTransferencias] = useState(transferenciasIniciais)
  const [showModalNovo, setShowModalNovo] = useState(false)
  const [showModalTransferencia, setShowModalTransferencia] = useState(false)
  const [bancoExtrato, setBancoExtrato] = useState<Banco | null>(null)

  async function handleToggleAtivo(id: string) {
    const resultado = await toggleAtivoBanco(id)
    if (!resultado.success) { toast.error(resultado.error); return }
    setBancos(prev => prev.map(b => b.id === id ? { ...b, ativo: !b.ativo } : b))
    toast.success('Status atualizado.')
  }

  async function handleExcluir(id: string) {
    const resultado = await excluirBanco(id)
    if (!resultado.success) { toast.error(resultado.error); throw new Error(resultado.error) }
    setBancos(prev => prev.filter(b => b.id !== id))
    toast.success('Banco excluído.')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {bancos.length === 0 ? 'Nenhum banco cadastrado ainda.' : `${bancos.length} banco(s) cadastrado(s).`}
        </p>
        <button
          onClick={() => setShowModalNovo(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <Plus size={16} /> Novo Banco
        </button>
      </div>

      {bancos.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-border rounded-xl">
          Cadastre seu primeiro banco pra começar a vincular pagamentos e recebimentos a ele.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bancos.map(b => (
            <div
              key={b.id}
              onClick={() => setBancoExtrato(b)}
              className={`bg-surface border border-border rounded-xl p-4 cursor-pointer hover:border-gray-500 transition-colors ${!b.ativo ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary-hover/10 text-primary-text flex items-center justify-center flex-shrink-0">
                  <Landmark size={18} />
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleAtivo(b.id)}
                    className={`p-1.5 rounded-md transition-colors ${b.ativo ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:bg-surface-highlight'}`}
                    title={b.ativo ? 'Desativar banco' : 'Ativar banco'}
                  >
                    <Power size={15} />
                  </button>
                  <BotaoDeletar
                    onConfirm={() => handleExcluir(b.id)}
                    titulo="Excluir banco?"
                    descricao="Só é possível excluir bancos sem lançamentos vinculados."
                  />
                </div>
              </div>
              <p className="font-semibold text-foreground truncate">{b.nome}</p>
              <p className={`text-xl font-bold mt-1 ${b.saldo_atual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatarMoeda(b.saldo_atual)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Saldo inicial: {formatarMoeda(b.saldo_inicial)}</p>
              {!b.ativo && <p className="text-xs text-gray-500 mt-1">Inativo</p>}
            </div>
          ))}
        </div>
      )}

      {bancos.length > 1 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowModalTransferencia(true)}
            className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-highlight transition-colors"
          >
            <ArrowLeftRight size={16} /> Transferência entre contas
          </button>

          {transferencias.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-background/50">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transferências entre contas</h2>
              </div>
              <div className="divide-y divide-border max-h-80 overflow-y-auto">
                {transferencias.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {t.tipo === 'ENTRADA'
                        ? <ArrowUpCircle size={14} className="text-emerald-400 flex-shrink-0" />
                        : <ArrowDownCircle size={14} className="text-red-400 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-foreground truncate">{t.banco.nome} <span className="text-gray-500">— {t.descricao}</span></p>
                        <p className="text-xs text-gray-500">{formatarData(t.dt_movimento)}</p>
                      </div>
                    </div>
                    <span className={`font-semibold whitespace-nowrap flex-shrink-0 ${t.tipo === 'SAIDA' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {t.tipo === 'SAIDA' ? '-' : '+'}{formatarMoeda(t.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModalNovo && (
        <ModalNovoBanco
          onClose={() => setShowModalNovo(false)}
          onSuccess={banco => { setBancos(prev => [...prev, banco].sort((a, b) => a.nome.localeCompare(b.nome))); setShowModalNovo(false) }}
        />
      )}

      {showModalTransferencia && (
        <ModalTransferencia
          bancos={bancos}
          onClose={() => setShowModalTransferencia(false)}
          onSuccess={async (origemId, saldoOrigem, destinoId, saldoDestino) => {
            setBancos(prev => prev.map(b => {
              if (b.id === origemId) return { ...b, saldo_atual: saldoOrigem }
              if (b.id === destinoId) return { ...b, saldo_atual: saldoDestino }
              return b
            }))
            setShowModalTransferencia(false)
            const atualizadas = await getTransferencias()
            setTransferencias(atualizadas as Transferencia[])
          }}
        />
      )}

      {bancoExtrato && (
        <ModalExtratoBanco
          banco={bancoExtrato}
          planoContas={planoContas}
          onClose={() => setBancoExtrato(null)}
          onSaldoAtualizado={(id, saldo_atual) => {
            setBancos(prev => prev.map(b => b.id === id ? { ...b, saldo_atual } : b))
            setBancoExtrato(prev => prev && prev.id === id ? { ...prev, saldo_atual } : prev)
          }}
        />
      )}
    </div>
  )
}

function ModalNovoBanco({ onClose, onSuccess }: { onClose: () => void; onSuccess: (banco: Banco) => void }) {
  const [loading, setLoading] = useState(false)
  const [nome, setNome] = useState('')
  const [saldoCentavos, setSaldoCentavos] = useState(0)
  const [saldoDisplay, setSaldoDisplay] = useState('')

  function handleSaldoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, '')
    const centavos = parseInt(apenasDigitos || '0', 10)
    setSaldoCentavos(centavos)
    setSaldoDisplay(centavos > 0 ? formatarMoedaCentavos(centavos) : '')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData()
    formData.set('nome', nome)
    formData.set('saldo_inicial', (saldoCentavos / 100).toFixed(2))

    const resultado = await criarBanco(formData)
    setLoading(false)
    if (!resultado.success) { toast.error(resultado.error); return }

    toast.success('Banco criado.')
    onSuccess({
      ...resultado.data,
      saldo_inicial: Number(resultado.data.saldo_inicial),
      saldo_atual: Number(resultado.data.saldo_atual),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">Novo Banco</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome do Banco *</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Banco Inter, Nubank, Caixa..."
              required
              autoFocus
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Saldo Inicial *</label>
            <input
              type="text"
              inputMode="numeric"
              value={saldoDisplay}
              onChange={handleSaldoChange}
              placeholder="R$ 0,00"
              required={saldoCentavos === 0}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50 transition-colors">
              {loading ? 'Criando...' : 'Criar Banco'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalTransferencia({
  bancos,
  onClose,
  onSuccess,
}: {
  bancos: Banco[]
  onClose: () => void
  onSuccess: (origemId: string, saldoOrigem: number, destinoId: string, saldoDestino: number) => void
}) {
  const bancosAtivos = bancos.filter(b => b.ativo)
  const [loading, setLoading] = useState(false)
  const [origemId, setOrigemId] = useState(bancosAtivos[0]?.id ?? '')
  const [destinoId, setDestinoId] = useState(bancosAtivos.find(b => b.id !== bancosAtivos[0]?.id)?.id ?? '')
  const [valorCentavos, setValorCentavos] = useState(0)
  const [valorDisplay, setValorDisplay] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, '')
    const centavos = parseInt(apenasDigitos || '0', 10)
    setValorCentavos(centavos)
    setValorDisplay(centavos > 0 ? formatarMoedaCentavos(centavos) : '')
  }

  function handleOrigemChange(novoOrigemId: string) {
    setOrigemId(novoOrigemId)
    // "Para" não pode ficar igual a "De" — se o usuário trocar "De" para o banco que
    // já estava selecionado em "Para", troca o "Para" pra outro automaticamente.
    if (destinoId === novoOrigemId) {
      const outro = bancosAtivos.find(b => b.id !== novoOrigemId)
      setDestinoId(outro?.id ?? '')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (origemId === destinoId) { toast.error('Selecione bancos diferentes.'); return }
    if (valorCentavos <= 0) { toast.error('Informe o valor da transferência.'); return }

    setLoading(true)
    const formData = new FormData()
    formData.set('banco_origem_id', origemId)
    formData.set('banco_destino_id', destinoId)
    formData.set('valor', (valorCentavos / 100).toFixed(2))
    formData.set('descricao', descricao)
    formData.set('dt_movimento', data)

    const resultado = await transferirEntreContas(formData)
    setLoading(false)
    if (!resultado.success) { toast.error(resultado.error); return }

    toast.success('Transferência realizada.')
    onSuccess(origemId, resultado.data.saldoOrigem, destinoId, resultado.data.saldoDestino)
  }

  if (bancosAtivos.length < 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4">
          <p className="text-sm text-gray-400">Você precisa de pelo menos 2 bancos ativos para transferir entre contas.</p>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">Transferência entre contas</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">De *</label>
            <select
              value={origemId}
              onChange={e => handleOrigemChange(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            >
              {bancosAtivos.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Para *</label>
            <select
              value={destinoId}
              onChange={e => setDestinoId(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            >
              {bancosAtivos.filter(b => b.id !== origemId).map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Valor *</label>
              <input
                type="text"
                inputMode="numeric"
                value={valorDisplay}
                onChange={handleValorChange}
                placeholder="R$ 0,00"
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data *</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Observação</label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            />
          </div>
          <p className="text-xs text-gray-500">Não gera lançamento em contas a pagar/receber — só um débito e um crédito nos extratos dos bancos.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50 transition-colors">
              {loading ? 'Transferindo...' : 'Transferir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalExtratoBanco({
  banco,
  planoContas,
  onClose,
  onSaldoAtualizado,
}: {
  banco: Banco
  planoContas: PlanoContas[]
  onClose: () => void
  onSaldoAtualizado: (bancoId: string, saldo_atual: number) => void
}) {
  const [carregando, setCarregando] = useState(true)
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoBanco[]>([])
  const [showImportar, setShowImportar] = useState(false)

  function recarregarExtrato() {
    setCarregando(true)
    getExtratoBanco(banco.id).then(m => { setMovimentacoes(m as MovimentacaoBanco[]); setCarregando(false) })
  }

  useEffect(() => {
    getExtratoBanco(banco.id).then(m => { setMovimentacoes(m as MovimentacaoBanco[]); setCarregando(false) })
  }, [banco.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-4xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface">
          <div>
            <h2 className="text-lg font-bold">{banco.nome}</h2>
            <p className={`text-sm font-semibold mt-0.5 ${banco.saldo_atual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Saldo atual: {formatarMoeda(banco.saldo_atual)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportar(true)}
              className="flex items-center gap-1.5 bg-surface-highlight hover:bg-border text-foreground text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Upload size={14} /> Importar extrato
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {carregando ? (
            <p className="text-center text-gray-500 text-sm py-8">Carregando extrato...</p>
          ) : movimentacoes.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">Nenhuma movimentação ainda.</p>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] overscroll-x-contain">
                <table className="min-w-[640px] w-full text-sm">
                  <thead className="bg-background text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Data</th>
                      <th className="text-left px-3 py-2">Descrição</th>
                      <th className="text-right px-3 py-2">Valor</th>
                      <th className="text-right px-3 py-2">Saldo Anterior</th>
                      <th className="text-right px-3 py-2">Saldo Posterior</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movimentacoes.map(m => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatarData(m.dt_movimento)}</td>
                        <td className="px-3 py-2 text-foreground max-w-[320px]">
                          <div className="flex items-center gap-2">
                            {m.tipo === 'ENTRADA' && <ArrowUpCircle size={14} className="text-emerald-400 flex-shrink-0" />}
                            {m.tipo === 'SAIDA' && <ArrowDownCircle size={14} className="text-red-400 flex-shrink-0" />}
                            {m.tipo === 'AJUSTE_INICIAL' && <CircleDot size={14} className="text-primary-text flex-shrink-0" />}
                            <span className="truncate" title={m.descricao}>{m.descricao}</span>
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${m.tipo === 'SAIDA' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {m.tipo === 'SAIDA' ? '-' : '+'}{formatarMoeda(m.valor)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">{formatarMoeda(m.saldo_anterior)}</td>
                        <td className="px-3 py-2 text-right text-gray-300 font-medium whitespace-nowrap">{formatarMoeda(m.saldo_posterior)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showImportar && (
        <ModalImportarExtrato
          bancoId={banco.id}
          bancoNome={banco.nome}
          planoContas={planoContas}
          onClose={() => setShowImportar(false)}
          onImportado={(saldo_atual) => {
            onSaldoAtualizado(banco.id, saldo_atual)
            recarregarExtrato()
          }}
        />
      )}
    </div>
  )
}
