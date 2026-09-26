'use client'

import { useEffect, useMemo } from 'react'
import { Download, X } from 'lucide-react'

interface Props {
  pdfBlob: Blob
  onClose: () => void
  nomeArquivo?: string
}

export default function ModalPreviewPdf({ pdfBlob, onClose, nomeArquivo = 'documento.pdf' }: Props) {
  const url = useMemo(() => URL.createObjectURL(pdfBlob), [pdfBlob])

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  function handleDownload() {
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface/50 flex-shrink-0 gap-3">
          <h3 className="font-bold text-foreground truncate">Pré-visualização do PDF</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
              title="Baixar PDF"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Baixar</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-foreground transition-colors" title="Fechar">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-gray-600 overflow-hidden">
          <iframe src={url} className="w-full h-full border-0" title="Pré-visualização do PDF" />
        </div>
      </div>
    </div>
  )
}
