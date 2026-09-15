import { redirect } from 'next/navigation'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Home() {
  const usuario = await getUsuarioLogado()
  if (!usuario) redirect('/login')

  redirect('/financeiro/balancete')
}
