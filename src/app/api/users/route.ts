import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, paginatedOk, getPagination, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'

const createUserSchema = z.object({
  employeeId: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(['SUPER_ADMIN', 'CMD', 'CSO', 'DIR_TECH', 'HR']),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'CMD', 'DIR_TECH', 'HR'])
    if (error) return error

    const { page, pageSize, skip } = getPagination(req.nextUrl)
    const search = req.nextUrl.searchParams.get('search') || ''
    const role = req.nextUrl.searchParams.get('role') as UserRole | null

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { employeeId: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(role && { role }),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, employeeId: true, name: true, email: true, role: true,
          title: true, department: true, phone: true, isActive: true,
          avatarUrl: true, lastLoginAt: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ])

    return paginatedOk(users, total, page, pageSize)
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO'])
    if (error) return error

    const body = await req.json()
    const data = createUserSchema.parse(body)

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { employeeId: data.employeeId }] },
    })
    if (existing) return err('Employee ID or email already exists', 409)

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : await bcrypt.hash('Temp@123', 12)

    const user = await prisma.user.create({
      data: {
        employeeId: data.employeeId,
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role as UserRole,
        title: data.title,
        department: data.department,
        phone: data.phone,
        createdById: session!.user.id,
      },
      select: {
        id: true, employeeId: true, name: true, email: true, role: true,
        title: true, department: true, isActive: true, createdAt: true,
      },
    })

    await auditLog(session!.user.id, 'CREATE_USER', 'User', user.id, undefined, { name: user.name, role: user.role }, req)
    return ok(user, 201)
  } catch (e) { return handleError(e) }
}
