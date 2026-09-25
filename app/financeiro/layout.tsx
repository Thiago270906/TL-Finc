import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { getUsuarioLogado } from '@/lib/usuario-logado'
import { getConfiguracaoSistema } from '@/app/actions'

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await getUsuarioLogado()

  if (!usuario) redirect('/login')

  const config = await getConfiguracaoSistema()

  return (
    <AuthenticatedLayout usuario={usuario as unknown as import('@/types').Usuario} controleBancosAtivo={config.controle_bancos_ativo}>
      {children}
    </AuthenticatedLayout>
  )
}
