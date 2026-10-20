'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { X, User, Palette, Sun, Moon, Check, Settings2, Landmark, TrendingUp, Loader2, Smile } from 'lucide-react'
import { atualizarUsuario, getConfiguracaoSistema, toggleControleBancos, toggleInvestimentoAtivo } from '@/app/actions'
import { CORES_SISTEMA, salvarAparencia, lerAparenciaSalva, type TemaFundo, type CorSistema, type EstiloIcone } from '@/lib/theme'
import type { Usuario } from '@/types'

interface Props {
  usuario: Usuario
  onClose: () => void
  estiloIcone: EstiloIcone
  onEstiloIconeChange: (estilo: EstiloIcone) => void
}

export default function ModalConfiguracoes({ usuario, onClose, estiloIcone, onEstiloIconeChange }: Props) {
  const [aba, setAba] = useState<'usuario' | 'aplicativo' | 'sistema'>('usuario')

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-surface border border-border w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-bold">Configurações</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="flex px-5 pt-4 gap-2">
          <TabButton icon={<User size={15} />} label="Usuário" active={aba === 'usuario'} onClick={() => setAba('usuario')} />
          <TabButton icon={<Palette size={15} />} label="Aplicativo" active={aba === 'aplicativo'} onClick={() => setAba('aplicativo')} />
          <TabButton icon={<Settings2 size={15} />} label="Sistema" active={aba === 'sistema'} onClick={() => setAba('sistema')} />
        </div>

        <div className="p-5">
          {aba === 'usuario' ? (
            <AbaUsuario usuario={usuario} onClose={onClose} />
          ) : aba === 'aplicativo' ? (
            <AbaAplicativo estiloIcone={estiloIcone} onEstiloIconeChange={onEstiloIconeChange} />
          ) : (
            <AbaSistema />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-primary text-white' : 'text-gray-400 hover:bg-surface-highlight hover:text-foreground'
      }`}
    >
      {icon} {label}
    </button>
  )
}

function AbaUsuario({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const resultado = await atualizarUsuario(formData)

    if (!resultado.success) {
      toast.error(resultado.error)
      setLoading(false)
      return
    }

    if (resultado.data.emailAlterado) {
      toast.success('E-mail atualizado. Faça login novamente.')
      await signOut({ callbackUrl: '/login' })
      return
    }

    toast.success('Dados atualizados com sucesso.')
    setLoading(false)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="nome">Nome</label>
        <input
          id="nome"
          name="nome"
          defaultValue={usuario.nome}
          required
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={usuario.email}
          required
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
        />
        <p className="text-[11px] text-gray-500 mt-1">Alterar o e-mail exige um novo login.</p>
      </div>

      <div className="pt-2 border-t border-border space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Alterar senha (opcional)</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="senha">Nova senha</label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="confirmar_senha">Confirmar nova senha</label>
            <input
              id="confirmar_senha"
              name="confirmar_senha"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-hover"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium disabled:opacity-50 transition-colors">
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  )
}

function AbaAplicativo({ estiloIcone, onEstiloIconeChange }: { estiloIcone: EstiloIcone; onEstiloIconeChange: (estilo: EstiloIcone) => void }) {
  const [aparencia, setAparencia] = useState(lerAparenciaSalva)

  function mudarTema(tema: TemaFundo) {
    const nova = { ...aparencia, tema }
    setAparencia(nova)
    salvarAparencia(nova)
  }

  function mudarCor(cor: CorSistema) {
    const nova = { ...aparencia, cor }
    setAparencia(nova)
    salvarAparencia(nova)
  }

  function mudarEstiloIcone(estilo: EstiloIcone) {
    const nova = { ...aparencia, estiloIcone: estilo }
    setAparencia(nova)
    salvarAparencia(nova)
    onEstiloIconeChange(estilo)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cor de fundo</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => mudarTema('dark')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition-colors ${
              aparencia.tema === 'dark' ? 'border-primary-hover bg-primary/10 text-primary-text' : 'border-border text-gray-400 hover:bg-surface-highlight'
            }`}
          >
            <Moon size={16} /> Preto
          </button>
          <button
            onClick={() => mudarTema('light')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition-colors ${
              aparencia.tema === 'light' ? 'border-primary-hover bg-primary/10 text-primary-text' : 'border-border text-gray-400 hover:bg-surface-highlight'
            }`}
          >
            <Sun size={16} /> Branco
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cor do sistema</p>
        <div className="grid grid-cols-4 gap-3">
          {CORES_SISTEMA.map(c => (
            <button
              key={c.id}
              onClick={() => mudarCor(c.id)}
              title={c.label}
              className="flex flex-col items-center gap-1.5 group"
            >
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-offset-2 ring-offset-surface transition-all"
                style={{
                  backgroundColor: c.hex,
                  ['--tw-ring-color' as string]: aparencia.cor === c.id ? c.hex : 'transparent',
                }}
              >
                {aparencia.cor === c.id && <Check size={16} className="text-white" strokeWidth={3} />}
              </span>
              <span className="text-[11px] text-gray-400 group-hover:text-foreground transition-colors">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ícones do menu</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => mudarEstiloIcone('emoji')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition-colors ${
              estiloIcone === 'emoji' ? 'border-primary-hover bg-primary/10 text-primary-text' : 'border-border text-gray-400 hover:bg-surface-highlight'
            }`}
          >
            <Smile size={16} /> Emoji
          </button>
          <button
            onClick={() => mudarEstiloIcone('icone')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition-colors ${
              estiloIcone === 'icone' ? 'border-primary-hover bg-primary/10 text-primary-text' : 'border-border text-gray-400 hover:bg-surface-highlight'
            }`}
          >
            <Landmark size={16} /> Ícone
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 pt-2 border-t border-border">
        A aparência é aplicada automaticamente e fica salva neste dispositivo.
      </p>
    </div>
  )
}

function AbaSistema() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [ativoBancos, setAtivoBancos] = useState(false)
  const [ativoInvestimento, setAtivoInvestimento] = useState(false)
  const [alternandoBancos, setAlternandoBancos] = useState(false)
  const [alternandoInvestimento, setAlternandoInvestimento] = useState(false)

  useEffect(() => {
    getConfiguracaoSistema().then(config => {
      setAtivoBancos(config.controle_bancos_ativo)
      setAtivoInvestimento(config.investimento_ativo)
      setCarregando(false)
    })
  }, [])

  async function handleToggleBancos() {
    setAlternandoBancos(true)
    const resultado = await toggleControleBancos()
    setAlternandoBancos(false)
    if (!resultado.success) { toast.error(resultado.error); return }
    setAtivoBancos(resultado.data.controle_bancos_ativo)
    toast.success(resultado.data.controle_bancos_ativo ? 'Controle de Bancos ativado.' : 'Controle de Bancos desativado.')
    router.refresh()
  }

  async function handleToggleInvestimento() {
    setAlternandoInvestimento(true)
    const resultado = await toggleInvestimentoAtivo()
    setAlternandoInvestimento(false)
    if (!resultado.success) { toast.error(resultado.error); return }
    setAtivoInvestimento(resultado.data.investimento_ativo)
    toast.success(resultado.data.investimento_ativo ? 'Investimentos ativado.' : 'Investimentos desativado.')
    router.refresh()
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/40 p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ativoBancos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-highlight text-gray-400'}`}>
            <Landmark size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Controle de Bancos</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Cadastre bancos com saldo, vincule lançamentos a eles e acompanhe o saldo atualizado automaticamente em Contas a Pagar/Receber e no Balancete.
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleBancos}
          disabled={alternandoBancos}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${ativoBancos ? 'bg-emerald-600' : 'bg-surface-highlight border border-border'}`}
          aria-label="Ativar controle de Bancos"
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ativoBancos ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/40 p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ativoInvestimento ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-highlight text-gray-400'}`}>
            <TrendingUp size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Investimentos</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Registre aportes e resgates que debitam/creditam de verdade o saldo de um banco, com rastro no extrato dele.
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleInvestimento}
          disabled={alternandoInvestimento}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${ativoInvestimento ? 'bg-emerald-600' : 'bg-surface-highlight border border-border'}`}
          aria-label="Ativar Investimentos"
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ativoInvestimento ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <p className="text-[11px] text-gray-500 pt-2 border-t border-border">
        Desativado por padrão. Ativando ou desativando, nada do que já foi cadastrado é apagado — o recurso só passa a aparecer ou desaparecer no menu lateral.
      </p>
    </div>
  )
}
