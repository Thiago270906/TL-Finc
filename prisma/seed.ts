import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const email = 'thiagoohmlopes@gmail.com'
  const senhaPlana = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12)
  const senhaHash = await bcrypt.hash(senhaPlana, 10)

  const usuario = await prisma.usuario.create({
    data: {
      nome: 'Thiago',
      email,
      senha: senhaHash,
      ativo: true,
    },
  })

  await prisma.planoContas.createMany({
    data: [
      { tipo: 'RECEITA', nome: 'Receita Geral', usuario_id: usuario.id },
      { tipo: 'DESPESA', nome: 'Despesa Geral', usuario_id: usuario.id },
    ],
  })

  console.log('Seed OK')
  console.log(`  Login: ${email}`)
  console.log(`  Senha: ${senhaPlana}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
