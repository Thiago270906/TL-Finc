'use client'

import { useActionState, useState } from 'react'
import { Wallet, LogIn, UserPlus } from 'lucide-react'
import { authenticate, registrar } from '@/app/actions'

export default function LoginPage() {
  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar')
  const [erroLogin, dispatchLogin, pendingLogin] = useActionState(authenticate, undefined)
  const [erroCadastro, dispatchCadastro, pendingCadastro] = useActionState(registrar, undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100 p-4 overflow-y-auto">
      <div className="w-full max-w-sm my-8 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">

        {/* MARCA */}
        <div className="pt-8 pb-6 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/25">
            <Wallet size={26} className="text-white" />
          </div>
          <span className="text-gray-900 font-bold text-lg tracking-wide">TL-Finc</span>
        </div>

        {/* ABAS */}
        <div className="flex px-6 gap-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setModo('entrar')}
            className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
              modo === 'entrar' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setModo('cadastro')}
            className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
              modo === 'cadastro' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Criar conta
          </button>
        </div>

        {/* FORMULÁRIO */}
        {modo === 'entrar' ? (
          <form key="entrar" action={dispatchLogin} className="px-8 py-6 space-y-4">
            <Campo label="E-mail" id="email" name="email" type="email" placeholder="voce@exemplo.com" autoFocus required />
            <Campo label="Senha" id="password" name="password" type="password" placeholder="••••••••" required />

            {erroLogin && <MensagemErro texto={erroLogin} />}

            <div className="pt-2">
              <BotaoSubmit pending={pendingLogin} texto="Entrar" textoPendente="Entrando..." icone={<LogIn size={16} />} />
            </div>
          </form>
        ) : (
          <form key="cadastro" action={dispatchCadastro} className="px-8 py-6 space-y-4">
            <Campo label="Nome" id="nome" name="nome" type="text" placeholder="Seu nome completo" autoFocus required />
            <Campo label="E-mail" id="cad-email" name="email" type="email" placeholder="voce@exemplo.com" required />
            <Campo label="Senha" id="senha" name="senha" type="password" placeholder="Mínimo 6 caracteres" minLength={6} required />
            <Campo label="Confirmar senha" id="confirmar_senha" name="confirmar_senha" type="password" placeholder="Repita a senha" minLength={6} required />

            {erroCadastro && <MensagemErro texto={erroCadastro} />}

            <div className="pt-2">
              <BotaoSubmit pending={pendingCadastro} texto="Criar conta" textoPendente="Criando conta..." icone={<UserPlus size={16} />} />
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Campo({
  label,
  id,
  ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-gray-400"
        {...props}
      />
    </div>
  )
}

function MensagemErro({ texto }: { texto: string }) {
  return (
    <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg flex items-center gap-2 border border-red-200">
      ⚠️ {texto}
    </div>
  )
}

function BotaoSubmit({ pending, texto, textoPendente, icone }: { pending: boolean; texto: string; textoPendente: string; icone: React.ReactNode }) {
  return (
    <button
      type="submit"
      aria-disabled={pending}
      disabled={pending}
      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
    >
      {pending ? textoPendente : <>{icone} {texto}</>}
    </button>
  )
}
