import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getConfiguracaoSistema, getTransferencias } from '@/app/actions'
import BancosView from '@/components/financeiro/BancosView'

export const dynamic = 'force-dynamic'

export default async function BancosPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const config = await getConfiguracaoSistema()
  if (!config.controle_bancos_ativo) redirect('/financeiro/balancete')

  const [bancos, planoContas, transferencias] = await Promise.all([
    prisma.banco.findMany({ orderBy: { nome: 'asc' } }),
    prisma.planoContas.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    getTransferencias(),
  ])

  const bancosSerializados = bancos.map(b => ({
    ...b,
    saldo_inicial: Number(b.saldo_inicial),
    saldo_atual: Number(b.saldo_atual),
  }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Bancos</h1>
        <p className="text-sm text-gray-500 mt-1">Cadastre suas contas bancárias e acompanhe o extrato de cada uma.</p>
      </header>
      <BancosView bancos={bancosSerializados} planoContas={planoContas} transferencias={transferencias} />
    </div>
  )
}
