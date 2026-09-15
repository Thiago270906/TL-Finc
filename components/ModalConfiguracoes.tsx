'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { X, User, Palette, Sun, Moon, Check } from 'lucide-react'
import { atualizarUsuario } from '@/app/actions'
import { CORES_SISTEMA, salvarAparencia, lerAparenciaSalva, type TemaFundo, type CorSistema } from '@/lib/theme'
import type { Usuario } from '@/types'

interface Props {
  usuario: Usuario
  onClose: () => void
}

export default function ModalConfiguracoes({ usuario, onClose }: Props) {
  const [aba, setAba] = useState<'usuario' | 'aplicativo'>('usuario')

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
        </div>

        <div className="p-5">
          {aba === 'usuario' ? <AbaUsuario usuario={usuario} onClose={onClose} /> : <AbaAplicativo />}
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

function AbaAplicativo() {
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

      <p className="text-[11px] text-gray-500 pt-2 border-t border-border">
        A aparência é aplicada automaticamente e fica salva neste dispositivo.
      </p>
    </div>
  )
}
