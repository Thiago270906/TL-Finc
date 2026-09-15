import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LancamentosView from '@/components/financeiro/LancamentosView'

export const dynamic = 'force-dynamic'

export default async function ContasAPagarPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const [lancamentos, planoContas] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: { tipo: 'DESPESA' },
      include: { plano_contas: true, anexos: true, parciais: { orderBy: { dt_pagamento: 'asc' } } },
      orderBy: { dt_vencimento: 'asc' },
    }),
    prisma.planoContas.findMany({
      where: { tipo: 'DESPESA', ativo: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const lancamentosSerializados = lancamentos.map(l => ({
    ...l,
    valor: Number(l.valor),
    parciais: l.parciais.map(p => ({ ...p, valor: Number(p.valor) })),
  }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie as despesas e obrigações financeiras.</p>
      </header>
      <LancamentosView
        lancamentos={lancamentosSerializados as never}
        planoContas={planoContas}
        tipo="DESPESA"
      />
    </div>
  )
}
