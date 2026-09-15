import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await getUsuarioLogado()

  if (!usuario) redirect('/login')

  return (
    <AuthenticatedLayout usuario={usuario as unknown as import('@/types').Usuario}>
      {children}
    </AuthenticatedLayout>
  )
}
