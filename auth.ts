import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { authConfig } from './auth.config';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = LoginSchema.safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;

          const user = await prisma.usuario.findUnique({ where: { email } });

          if (!user) return null;

          if (!user.ativo) {
             return null // Bloqueia o login de usuários inativos
          }

          if (!user.senha) {
            return null // Conta criada via Google — não tem senha local
          }

          const passwordsMatch = await bcrypt.compare(password, user.senha);
          if (passwordsMatch) return user;
        }

        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;
      if (!user.email) return false;

      const email = user.email.toLowerCase();
      const existente = await prisma.usuario.findUnique({ where: { email } });

      if (existente) {
        if (!existente.ativo) return false
        user.id = existente.id
        return true
      }

      const novo = await prisma.usuario.create({
        data: {
          nome: user.name ?? email.split('@')[0],
          email,
          imagem: user.image ?? null,
        },
      });
      user.id = novo.id
      return true
    },
  },
});
