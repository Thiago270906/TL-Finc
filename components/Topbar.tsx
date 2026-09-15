'use client'

import { Wallet } from 'lucide-react'

interface Props {
  botaoMenu: React.ReactNode
}

export default function Topbar({ botaoMenu }: Props) {
  return (
    <header className="h-16 bg-surface border-b border-border flex items-center px-4 lg:px-6 flex-shrink-0 z-30">
      <div className="flex items-center gap-4">
         {botaoMenu}
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
              <Wallet size={16} />
            </div>
            <span className="text-lg font-bold tracking-wide text-foreground">TL-Finc</span>
         </div>
      </div>
    </header>
  )
}
