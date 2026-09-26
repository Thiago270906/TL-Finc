import { NextResponse } from 'next/server'
import { getUsuarioLogado } from '@/lib/usuario-logado'
import { analisarExtratoPdf } from '@/lib/extrato/analisar'
import type { ActionResult } from '@/types'
import type { PreviaImportacaoExtrato } from '@/lib/extrato/tipos'

export async function POST(request: Request) {
  const usuario = await getUsuarioLogado()
  if (!usuario) {
    return NextResponse.json<ActionResult<PreviaImportacaoExtrato>>({ success: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const formData = await request.formData()
  const bancoId = formData.get('bancoId')
  const arquivo = formData.get('arquivo')

  if (typeof bancoId !== 'string' || !bancoId) {
    return NextResponse.json<ActionResult<PreviaImportacaoExtrato>>({ success: false, error: 'Banco não informado.' }, { status: 400 })
  }
  if (!(arquivo instanceof File)) {
    return NextResponse.json<ActionResult<PreviaImportacaoExtrato>>({ success: false, error: 'Selecione um arquivo PDF.' }, { status: 400 })
  }

  const resultado = await analisarExtratoPdf(bancoId, arquivo, usuario.id)
  return NextResponse.json(resultado)
}
