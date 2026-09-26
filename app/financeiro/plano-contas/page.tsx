import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getUsuarioLogado } from '@/lib/usuario-logado'
import PlanoContasView from '@/components/financeiro/PlanoContasView'

export const dynamic = 'force-dynamic'

export default async function PlanoContasPage() {
  const usuario = await getUsuarioLogado()
  if (!usuario) redirect('/login')

  const contas = await prisma.planoContas.findMany({
    where: { usuario_id: usuario.id },
    include: { _count: { select: { lancamentos: true } } },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
  })

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Plano de Contas</h1>
        <p className="text-sm text-gray-500 mt-1">Categorias para classificar receitas e despesas.</p>
      </header>
      <PlanoContasView contas={contas as never} />
    </div>
  )
}
