'use client'

import Image from 'next/image'

interface Props {
  botaoMenu: React.ReactNode
}

export default function Topbar({ botaoMenu }: Props) {
  return (
    <header className="h-16 bg-surface border-b border-border flex items-center px-4 lg:px-6 flex-shrink-0 z-30">
      <div className="flex items-center gap-4">
         {botaoMenu}
         <div className="flex items-center">
            <Image src="/logo-tlfin.png" alt="TL-Finc" width={346} height={366} className="h-14 w-auto object-contain" priority />
         </div>
      </div>
    </header>
  )
}
