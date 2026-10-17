'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, ArrowDownCircle, ArrowUpCircle, Pencil, TrendingUp, AlertTriangle } from 'lucide-react'
import { excluirInvestimento } from '@/app/actions-investimentos'
import BotaoDeletar from '@/components/BotaoDeletar'
import ModalInvestimento from '@/components/financeiro/ModalInvestimento'
import type { Banco, InvestimentoComBanco } from '@/types'

interface Props {
  investimentos: InvestimentoComBanco[]
  bancos: Banco[]
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR')
}

export default function InvestimentosView({ investimentos: inicial, bancos }: Props) {
  const [investimentos, setInvestimentos] = useState(inicial)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<InvestimentoComBanco | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'APORTE' | 'RESGATE'>('TODOS')
  const [filtroBanco, setFiltroBanco] = useState('TODOS')
  const [busca, setBusca] = useState('')

  const bancosNoFiltro = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const i of investimentos) mapa.set(i.banco_id, i.banco.nome)
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }))
  }, [investimentos])

  const baseParaCards = useMemo(
    () => filtroBanco === 'TODOS' ? investimentos : investimentos.filter(i => i.banco_id === filtroBanco),
    [investimentos, filtroBanco]
  )

  const { totalAportado, totalResgatado } = useMemo(() => {
    return baseParaCards.reduce(
      (acc, i) => {
        if (i.tipo === 'APORTE') acc.totalAportado += i.valor
        else acc.totalResgatado += i.valor
        return acc
      },
      { totalAportado: 0, totalResgatado: 0 }
    )
  }, [baseParaCards])

  const saldoInvestido = totalAportado - totalResgatado

  const listaFiltrada = useMemo(() => {
    return baseParaCards.filter(i => {
      if (filtroTipo !== 'TODOS' && i.tipo !== filtroTipo) return false
      if (busca && !i.descricao.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [baseParaCards, filtroTipo, busca])

  async function handleExcluir(id: string) {
    const resultado = await excluirInvestimento(id)
    if (!resultado.success) { toast.error(resultado.error); throw new Error(resultado.error) }
    setInvestimentos(prev => prev.filter(i => i.id !== id))
    toast.success('Movimento excluído.')
  }

  function handleSuccess(investimento: InvestimentoComBanco) {
    setInvestimentos(prev => {
      const existe = prev.some(i => i.id === investimento.id)
      const atualizada = existe ? prev.map(i => i.id === investimento.id ? investimento : i) : [investimento, ...prev]
      return [...atualizada].sort((a, b) => new Date(b.dt_movimento).getTime() - new Date(a.dt_movimento).getTime())
    })
    setShowModal(false)
    setEditando(null)
  }

  return (
    <div className="space-y-4">
      {bancos.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <p>
            Você ainda não tem nenhum banco ativo cadastrado. Aportes e resgates sempre saem/voltam de um banco real —{' '}
            <Link href="/financeiro/bancos" className="underline font-medium">cadastre um banco primeiro</Link>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Aportado</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{formatarMoeda(totalAportado)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Resgatado</p>
          <p className="text-xl font-bold text-red-400 mt-1">{formatarMoeda(totalResgatado)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Saldo Investido</p>
          <p className="text-xl font-bold text-primary-text mt-1 flex items-center gap-2">
            <TrendingUp size={18} /> {formatarMoeda(saldoInvestido)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as 'TODOS' | 'APORTE' | 'RESGATE')}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
          >
            <option value="TODOS">Todos os tipos</option>
            <option value="APORTE">Aportes</option>
            <option value="RESGATE">Resgates</option>
          </select>
          <select
            value={filtroBanco}
            onChange={e => setFiltroBanco(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
          >
            <option value="TODOS">Todos os bancos</option>
            {bancosNoFiltro.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por descrição..."
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
          />
        </div>
        <button
          onClick={() => { setEditando(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <Plus size={16} /> Novo Movimento
        </button>
      </div>

      {listaFiltrada.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-border rounded-xl">
          Nenhum movimento encontrado.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] overscroll-x-contain">
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-background text-gray-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-left px-3 py-2">Banco</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="text-right px-3 py-2">Saldo do banco</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listaFiltrada.map(i => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatarData(i.dt_movimento)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${i.tipo === 'APORTE' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {i.tipo === 'APORTE' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                        {i.tipo === 'APORTE' ? 'Aporte' : 'Resgate'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground max-w-[240px]">
                      <span className="truncate" title={i.descricao}>{i.descricao}</span>
                      {i.numero_documento && <span className="block text-xs text-gray-500">{i.numero_documento}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{i.banco.nome}</td>
                    <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${i.tipo === 'RESGATE' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {i.tipo === 'RESGATE' ? '-' : '+'}{formatarMoeda(i.valor)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">
                      {formatarMoeda(i.saldo_banco_anterior)} → {formatarMoeda(i.saldo_banco_posterior)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditando(i); setShowModal(true) }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <BotaoDeletar
                          onConfirm={() => handleExcluir(i.id)}
                          titulo="Excluir movimento?"
                          descricao="Isso estorna o valor no saldo do banco. Só é possível excluir um aporte se não deixar resgates órfãos."
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ModalInvestimento
          bancos={bancos}
          investimento={editando ?? undefined}
          onClose={() => { setShowModal(false); setEditando(null) }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
