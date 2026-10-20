'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Topbar from '@/components/Topbar'
import ModalConfiguracoes from '@/components/ModalConfiguracoes'
import { signOut } from 'next-auth/react'
import { Menu, Settings, LogOut, BarChart3, ArrowUpCircle, ArrowDownCircle, FolderTree, Landmark, TrendingUp, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { lerAparenciaSalva, type EstiloIcone } from '@/lib/theme'
import type { Usuario } from '@/types'

const ITENS_FINANCEIRO = [
  { href: '/financeiro/balancete', icon: '📊', Icone: BarChart3, label: 'Balancete' },
  { href: '/financeiro/contas-a-pagar', icon: '📤', Icone: ArrowUpCircle, label: 'Contas a Pagar' },
  { href: '/financeiro/contas-a-receber', icon: '📥', Icone: ArrowDownCircle, label: 'Contas a Receber' },
  { href: '/financeiro/plano-contas', icon: '🗂️', Icone: FolderTree, label: 'Plano de Contas' },
] as const

const ITEM_BANCOS = { href: '/financeiro/bancos', icon: '🏦', Icone: Landmark, label: 'Bancos' } as const
const ITEM_INVESTIMENTOS = { href: '/financeiro/investimentos', icon: '📈', Icone: TrendingUp, label: 'Investimentos' } as const

interface AuthenticatedLayoutProps {
  children: React.ReactNode
  usuario: Usuario
  controleBancosAtivo?: boolean
  investimentoAtivo?: boolean
}

export default function AuthenticatedLayout({ children, usuario, controleBancosAtivo, investimentoAtivo }: AuthenticatedLayoutProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showConfiguracoes, setShowConfiguracoes] = useState(false)
  // Começa com o padrão (igual ao SSR) e só lê o valor salvo após montar no cliente,
  // para não divergir da marcação renderizada no servidor e causar erro de hidratação.
  const [estiloIcone, setEstiloIcone] = useState<EstiloIcone>('emoji')
  useEffect(() => {
    // Sincroniza com o valor salvo no localStorage só depois de montar — ler no
    // initializer do useState divergiria do HTML renderizado no servidor (sem acesso
    // a localStorage) e causaria erro de hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstiloIcone(lerAparenciaSalva().estiloIcone)
  }, [])

  if (pathname?.startsWith('/login')) {
      return <main className="min-h-screen bg-gray-100 flex flex-col justify-center">{children}</main>
  }

  const itensMenu = [
    ...ITENS_FINANCEIRO,
    ...(controleBancosAtivo ? [ITEM_BANCOS] : []),
    ...(investimentoAtivo ? [ITEM_INVESTIMENTOS] : []),
  ]

  function fecharSidebarSeMobile() {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Topbar
        botaoMenu={
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-surface-highlight/50 text-gray-400 hover:text-foreground transition-all">
            <Menu size={20} />
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden relative">
         {/* Backdrop (somente mobile, quando a sidebar está aberta) */}
         {isSidebarOpen && (
           <div
             onClick={() => setIsSidebarOpen(false)}
             className="fixed left-0 right-0 top-16 bottom-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
           />
         )}

         <aside
           className={`
             fixed top-16 bottom-0 left-0 z-40 w-64
             ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
             lg:static lg:top-auto lg:bottom-auto lg:translate-x-0 lg:z-20 ${isSidebarOpen ? 'lg:w-64' : 'lg:w-[72px]'}
             bg-surface border-r border-border flex flex-col flex-shrink-0 transition-all duration-300
           `}
         >

            <div className="flex-1 flex flex-col overflow-hidden pt-4">
                <div className="p-2 space-y-1">
                  {itensMenu.map(item => (
                      <SidebarLink
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          Icone={item.Icone}
                          estiloIcone={estiloIcone}
                          label={item.label}
                          isOpen={isSidebarOpen}
                          active={pathname.startsWith(item.href)}
                          onNavigate={fecharSidebarSeMobile}
                      />
                  ))}
                </div>
            </div>

            <div className="mt-auto pt-2 border-t border-border pb-4 px-2 bg-surface space-y-1">
                 <button onClick={() => { setShowConfiguracoes(true); fecharSidebarSeMobile() }} className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-surface-highlight text-gray-500 hover:text-foreground whitespace-nowrap transition-colors ${!isSidebarOpen && 'justify-center'}`} title="Configurações">
                    <Settings size={18} className="flex-shrink-0" />
                    <span className={`ml-3 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Configurações</span>
                 </button>
                 <button onClick={() => signOut({ callbackUrl: '/login' })} className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 whitespace-nowrap transition-colors ${!isSidebarOpen && 'justify-center'}`} title="Sair">
                    <LogOut size={18} className="flex-shrink-0" />
                    <span className={`ml-3 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Sair</span>
                 </button>
            </div>
         </aside>

         <main className="flex-1 overflow-y-auto h-full bg-background p-4 lg:p-6">
            {children}
         </main>
      </div>

      {showConfiguracoes && (
        <ModalConfiguracoes
          usuario={usuario}
          onClose={() => setShowConfiguracoes(false)}
          estiloIcone={estiloIcone}
          onEstiloIconeChange={setEstiloIcone}
        />
      )}
    </div>
  )
}

interface SidebarLinkProps {
    href: string
    icon: string
    Icone: LucideIcon
    estiloIcone: EstiloIcone
    label: string
    isOpen: boolean
    active: boolean
    onNavigate?: () => void
}

function SidebarLink({ href, icon, Icone, estiloIcone, label, isOpen, active, onNavigate }: SidebarLinkProps) {
    return (
        <Link href={href} onClick={onNavigate} className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${!isOpen && 'justify-center'} ${active ? 'bg-primary-hover/10 text-primary-text border border-primary-hover/20 shadow-sm' : 'text-gray-400 border border-transparent hover:bg-surface-highlight hover:text-foreground'}`} title={!isOpen ? label : ''}>
            {estiloIcone === 'icone' ? <Icone size={18} className="flex-shrink-0" /> : <span className="text-lg">{icon}</span>}
            <span className={`ml-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{label}</span>
        </Link>
    )
}
