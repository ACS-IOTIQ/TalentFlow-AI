import type { UserRole } from '@prisma/client'
import 'next-auth'

declare module 'next-auth' {
  interface User {
    role: UserRole
    employeeId: string
    avatarUrl?: string | null
  }

  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: UserRole
      employeeId: string
      avatarUrl?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    employeeId: string
    avatarUrl?: string | null
  }
}
