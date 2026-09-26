import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LancamentosView from '@/components/financeiro/LancamentosView'
import { getConfiguracaoSistema } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function ContasAReceberPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const config = await getConfiguracaoSistema()

  // A tela abre com o mês atual selecionado — busca já só esse mês em vez de todo o
  // histórico (que só cresce com o tempo). Trocar de mês/período dispara uma nova busca.
  const agora = new Date()
  const anoMes = agora.getFullYear()
  const mesAtual = agora.getMonth() + 1
  const dataInicioMes = `${anoMes}-${String(mesAtual).padStart(2, '0')}-01`
  const ultimoDiaMes = new Date(anoMes, mesAtual, 0).getDate()
  const dataFimMes = `${anoMes}-${String(mesAtual).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`

  const [lancamentos, planoContas, bancos] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: {
        tipo: 'RECEITA',
        dt_vencimento: {
          gte: new Date(`${dataInicioMes}T00:00:00.000Z`),
          lte: new Date(`${dataFimMes}T23:59:59.999Z`),
        },
      },
      include: { plano_contas: true, anexos: true, banco: true, parciais: { orderBy: { dt_pagamento: 'asc' } } },
      orderBy: { dt_vencimento: 'asc' },
    }),
    prisma.planoContas.findMany({
      where: { tipo: 'RECEITA', ativo: true },
      orderBy: { nome: 'asc' },
    }),
    config.controle_bancos_ativo
      ? prisma.banco.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } })
      : Promise.resolve([]),
  ])

  const lancamentosSerializados = lancamentos.map(l => ({
    ...l,
    valor: Number(l.valor),
    saldo_banco_anterior: l.saldo_banco_anterior != null ? Number(l.saldo_banco_anterior) : null,
    saldo_banco_posterior: l.saldo_banco_posterior != null ? Number(l.saldo_banco_posterior) : null,
    banco: l.banco ? { ...l.banco, saldo_inicial: Number(l.banco.saldo_inicial), saldo_atual: Number(l.banco.saldo_atual) } : null,
    parciais: l.parciais.map(p => ({ ...p, valor: Number(p.valor) })),
  }))

  const bancosSerializados = bancos.map(b => ({ ...b, saldo_inicial: Number(b.saldo_inicial), saldo_atual: Number(b.saldo_atual) }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie as receitas e valores a receber.</p>
      </header>
      <LancamentosView
        lancamentos={lancamentosSerializados as never}
        planoContas={planoContas}
        tipo="RECEITA"
        bancos={bancosSerializados}
        controleBancosAtivo={config.controle_bancos_ativo}
      />
    </div>
  )
}
