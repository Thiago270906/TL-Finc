'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const CHAVE_DISPENSADO = 'tl-finc-instalar-dispensado'
const DIAS_PARA_REPERGUNTAR = 7

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function estaInstalado() {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone || iosStandalone
}

function foiDispensadoRecentemente() {
  if (typeof window === 'undefined') return false
  const bruto = window.localStorage.getItem(CHAVE_DISPENSADO)
  if (!bruto) return false
  const dispensadoEm = Number(bruto)
  if (Number.isNaN(dispensadoEm)) return false
  const diasPassados = (Date.now() - dispensadoEm) / 86400000
  return diasPassados < DIAS_PARA_REPERGUNTAR
}

export default function BotaoInstalarApp() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (estaInstalado() || foiDispensadoRecentemente()) return

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      setVisivel(true)
    }

    function handleAppInstalled() {
      setVisivel(false)
      setPromptEvent(null)
      window.localStorage.removeItem(CHAVE_DISPENSADO)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handleInstalar() {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
    setVisivel(false)
  }

  function handleDispensar() {
    window.localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()))
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div className="flex items-center gap-1 bg-primary/10 border border-primary-hover/30 rounded-lg pl-3 pr-1 py-1">
      <button
        onClick={handleInstalar}
        className="flex items-center gap-1.5 text-xs font-medium text-primary-text hover:text-foreground transition-colors"
        title="Instalar TL-Finc como aplicativo"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Instalar app</span>
      </button>
      <button
        onClick={handleDispensar}
        className="p-1 text-gray-400 hover:text-foreground transition-colors"
        title="Dispensar"
      >
        <X size={14} />
      </button>
    </div>
  )
}
