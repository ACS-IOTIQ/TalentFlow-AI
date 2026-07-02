import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { UserRole } from '@prisma/client'

const loginSchema = z.object({
  email: z.string().email().optional(),
  employeeId: z.string().optional(),
  password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        employeeId: { label: 'Employee ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, employeeId, password } = parsed.data

        const user = await prisma.user.findFirst({
          where: {
            isActive: true,
            OR: [
              email ? { email } : {},
              employeeId ? { employeeId } : {},
            ].filter(c => Object.keys(c).length > 0),
          },
        })

        if (!user || !user.passwordHash) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          employeeId: user.employeeId,
          avatarUrl: user.avatarUrl,
        }
      },
    }),
    ...(process.env.MS_TENANT_ID ? [
      MicrosoftEntraID({
        clientId: process.env.MS_CLIENT_ID!,
        clientSecret: process.env.MS_CLIENT_SECRET!,
        issuer: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/v2.0`,
      }),
    ] : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.employeeId = (user as any).employeeId
        token.avatarUrl = (user as any).avatarUrl
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.employeeId = token.employeeId as string
        session.user.avatarUrl = token.avatarUrl as string | undefined
      }
      return session
    },
  },
})
