export type TemaFundo = 'dark' | 'light'
export type CorSistema = 'indigo' | 'blue' | 'emerald' | 'red' | 'violet' | 'orange' | 'pink' | 'teal'

export const CORES_SISTEMA: { id: CorSistema; label: string; hex: string }[] = [
  { id: 'indigo', label: 'Índigo', hex: '#4f46e5' },
  { id: 'blue', label: 'Azul', hex: '#2563eb' },
  { id: 'emerald', label: 'Verde', hex: '#059669' },
  { id: 'red', label: 'Vermelho', hex: '#dc2626' },
  { id: 'violet', label: 'Roxo', hex: '#7c3aed' },
  { id: 'orange', label: 'Laranja', hex: '#ea580c' },
  { id: 'pink', label: 'Rosa', hex: '#db2777' },
  { id: 'teal', label: 'Ciano', hex: '#0d9488' },
]

export const TEMA_STORAGE_KEY = 'tl-finc-aparencia'

export interface Aparencia {
  tema: TemaFundo
  cor: CorSistema
}

export const APARENCIA_PADRAO: Aparencia = { tema: 'dark', cor: 'indigo' }

export function lerAparenciaSalva(): Aparencia {
  if (typeof window === 'undefined') return APARENCIA_PADRAO
  try {
    const bruto = window.localStorage.getItem(TEMA_STORAGE_KEY)
    if (!bruto) return APARENCIA_PADRAO
    const parsed = JSON.parse(bruto)
    return {
      tema: parsed.tema === 'light' ? 'light' : 'dark',
      cor: CORES_SISTEMA.some(c => c.id === parsed.cor) ? parsed.cor : 'indigo',
    }
  } catch {
    return APARENCIA_PADRAO
  }
}

export function aplicarAparencia(aparencia: Aparencia) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', aparencia.tema)
  document.documentElement.setAttribute('data-accent', aparencia.cor)
}

export function salvarAparencia(aparencia: Aparencia) {
  aplicarAparencia(aparencia)
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TEMA_STORAGE_KEY, JSON.stringify(aparencia))
}

/** Script inline executado antes da hidratação, para evitar flash de tema errado. */
export const SCRIPT_BOOT_TEMA = `
(function() {
  try {
    var raw = localStorage.getItem('${TEMA_STORAGE_KEY}');
    var tema = 'dark', cor = 'indigo';
    if (raw) {
      var p = JSON.parse(raw);
      if (p.tema === 'light') tema = 'light';
      if (p.cor) cor = p.cor;
    }
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.setAttribute('data-accent', cor);
  } catch (e) {}
})();
`
