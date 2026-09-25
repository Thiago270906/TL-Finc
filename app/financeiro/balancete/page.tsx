import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getBalancete, getConfiguracaoSistema } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import BalanceteView from '@/components/financeiro/BalanceteView'

export const dynamic = 'force-dynamic'

export default async function BalancetePage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const sp = await searchParams

  // Padrão: mês atual
  const hoje = new Date()
  const inicio = sp.inicio ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const fim = sp.fim ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`

  const config = await getConfiguracaoSistema()

  const [balancete, bancos] = await Promise.all([
    getBalancete(inicio, fim),
    config.controle_bancos_ativo
      ? prisma.banco.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } })
      : Promise.resolve([]),
  ])

  const bancosSerializados = bancos.map(b => ({ ...b, saldo_inicial: Number(b.saldo_inicial), saldo_atual: Number(b.saldo_atual) }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Balancete</h1>
        <p className="text-sm text-gray-500 mt-1">Resumo financeiro do período selecionado.</p>
      </header>
      <BalanceteView balancete={balancete} dataInicio={inicio} dataFim={fim} bancos={bancosSerializados} />
    </div>
  )
}
