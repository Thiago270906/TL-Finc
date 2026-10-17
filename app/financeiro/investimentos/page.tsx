import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getConfiguracaoSistema } from '@/app/actions'
import { getInvestimentos } from '@/app/actions-investimentos'
import { getUsuarioLogado } from '@/lib/usuario-logado'
import InvestimentosView from '@/components/financeiro/InvestimentosView'

export const dynamic = 'force-dynamic'

export default async function InvestimentosPage() {
  const usuario = await getUsuarioLogado()
  if (!usuario) redirect('/login')

  const config = await getConfiguracaoSistema()
  if (!config.investimento_ativo) redirect('/financeiro/balancete')

  const [investimentos, bancos] = await Promise.all([
    getInvestimentos(),
    prisma.banco.findMany({ where: { usuario_id: usuario.id, ativo: true }, orderBy: { nome: 'asc' } }),
  ])

  const bancosSerializados = bancos.map(b => ({
    ...b,
    saldo_inicial: Number(b.saldo_inicial),
    saldo_atual: Number(b.saldo_atual),
  }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Investimentos</h1>
        <p className="text-sm text-gray-500 mt-1">Registre aportes e resgates — o valor sai ou volta de verdade do saldo do banco escolhido.</p>
      </header>
      <InvestimentosView investimentos={investimentos} bancos={bancosSerializados} />
    </div>
  )
}
