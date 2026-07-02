import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['SUPER_ADMIN', 'CMD', 'CSO', 'DIR_TECH', 'HR']).optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true, employeeId: true, name: true, email: true, role: true,
        title: true, department: true, phone: true, isActive: true,
        avatarUrl: true, lastLoginAt: true, createdAt: true,
        _count: { select: { jdsCreated: true, candidatesUploaded: true, interviewsScheduled: true } },
      },
    })
    if (!user) return err('User not found', 404)
    return ok(user)
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO'])
    if (error) return error

    const body = await req.json()
    const data = updateUserSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { id: params.id } })
    if (!existing) return err('User not found', 404)

    const updateData: any = { ...data }
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12)
      delete updateData.password
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true, employeeId: true, name: true, email: true, role: true,
        title: true, department: true, isActive: true,
      },
    })

    await auditLog(session!.user.id, 'UPDATE_USER', 'User', params.id, { name: existing.name, role: existing.role }, { name: updated.name, role: updated.role }, req)
    return ok(updated)
  } catch (e) { return handleError(e) }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO'])
    if (error) return error

    if (params.id === session!.user.id) return err('Cannot delete your own account', 400)

    await prisma.user.update({ where: { id: params.id }, data: { isActive: false } })
    await auditLog(session!.user.id, 'DEACTIVATE_USER', 'User', params.id, undefined, undefined, req)
    return ok({ message: 'User deactivated' })
  } catch (e) { return handleError(e) }
}
