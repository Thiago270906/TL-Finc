'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { criarInvestimento, editarInvestimento } from '@/app/actions-investimentos'
import type { Banco, InvestimentoComBanco, TipoInvestimento } from '@/types'

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarMoedaCentavos(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  bancos: Banco[]
  investimento?: InvestimentoComBanco
  onClose: () => void
  onSuccess: (investimento: InvestimentoComBanco) => void
}

export default function ModalInvestimento({ bancos, investimento, onClose, onSuccess }: Props) {
  const modoEdicao = !!investimento
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState<TipoInvestimento>(investimento?.tipo ?? 'APORTE')
  const [bancoId, setBancoId] = useState(investimento?.banco_id ?? bancos[0]?.id ?? '')
  const valorInicialCentavos = investimento ? Math.round(investimento.valor * 100) : 0
  const [valorCentavos, setValorCentavos] = useState(valorInicialCentavos)
  const [valorDisplay, setValorDisplay] = useState(valorInicialCentavos > 0 ? formatarMoedaCentavos(valorInicialCentavos) : '')
  const [descricao, setDescricao] = useState(investimento?.descricao ?? '')
  const [numeroDocumento, setNumeroDocumento] = useState(investimento?.numero_documento ?? '')
  const [data, setData] = useState(() => {
    const base = investimento ? new Date(investimento.dt_movimento) : new Date()
    return base.toISOString().split('T')[0]
  })

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, '')
    const centavos = parseInt(apenasDigitos || '0', 10)
    setValorCentavos(centavos)
    setValorDisplay(centavos > 0 ? formatarMoedaCentavos(centavos) : '')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (valorCentavos <= 0) { toast.error('Informe o valor.'); return }
    if (!modoEdicao && !bancoId) { toast.error('Selecione o banco.'); return }

    setLoading(true)
    const formData = new FormData()
    formData.set('tipo', tipo)
    formData.set('descricao', descricao)
    formData.set('valor', (valorCentavos / 100).toFixed(2))
    formData.set('banco_id', bancoId)
    formData.set('numero_documento', numeroDocumento)
    formData.set('dt_movimento', data)

    const resultado = modoEdicao
      ? await editarInvestimento(investimento.id, formData)
      : await criarInvestimento(formData)

    setLoading(false)
    if (!resultado.success) { toast.error(resultado.error); return }

    toast.success(modoEdicao ? 'Movimento atualizado.' : 'Movimento registrado.')
    onSuccess(resultado.data)
  }

  if (!modoEdicao && bancos.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4">
          <p className="text-sm text-gray-400">Você precisa de pelo menos um banco ativo cadastrado para registrar um aporte ou resgate.</p>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface">
          <h2 className="text-lg font-bold">{modoEdicao ? 'Editar Movimento' : 'Novo Movimento'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipo('APORTE')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${tipo === 'APORTE' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-border text-gray-400 hover:bg-surface-highlight'}`}
            >
              <ArrowDownCircle size={16} /> Aporte
            </button>
            <button
              type="button"
              onClick={() => setTipo('RESGATE')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${tipo === 'RESGATE' ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-border text-gray-400 hover:bg-surface-highlight'}`}
            >
              <ArrowUpCircle size={16} /> Resgate
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Banco *</label>
            {modoEdicao ? (
              <div className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-gray-400">
                {investimento.banco.nome}
              </div>
            ) : (
              <select
                value={bancoId}
                onChange={e => setBancoId(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
              >
                {bancos.map(b => <option key={b.id} value={b.id}>{b.nome} — {formatarMoeda(b.saldo_atual)}</option>)}
              </select>
            )}
            {modoEdicao && <p className="text-[11px] text-gray-500 mt-1">O banco não pode ser alterado — exclua e recrie o movimento se precisar mudar.</p>}
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
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição *</label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Aplicação CDB, Tesouro Direto..."
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nº do documento</label>
            <input
              value={numeroDocumento}
              onChange={e => setNumeroDocumento(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            />
          </div>

          <p className="text-xs text-gray-500">
            {tipo === 'APORTE'
              ? 'O valor sai de verdade do saldo do banco selecionado.'
              : 'O valor volta de verdade para o saldo do banco selecionado.'}
          </p>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50 transition-colors">
              {loading ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
