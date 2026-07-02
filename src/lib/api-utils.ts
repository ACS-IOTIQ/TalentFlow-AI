import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import type { UserRole } from '@prisma/client'
import { logger } from '@/lib/logger'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function paginatedOk<T>(data: T[], total: number, page: number, pageSize: number) {
  return NextResponse.json({
    success: true,
    data,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await auth()
  if (!session?.user) {
    return { error: err('Unauthorized', 401), session: null }
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { error: err('Forbidden', 403), session: null }
  }
  return { error: null, session }
}

export function getPagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 20)))
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}

export async function auditLog(
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  oldValue?: object,
  newValue?: object,
  req?: Request,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue as any,
        newValue: newValue as any,
        ipAddress: req ? (req.headers.get('x-forwarded-for') || 'unknown') : undefined,
        userAgent: req ? (req.headers.get('user-agent') || undefined) : undefined,
      },
    })
  } catch (e) {
    logger.error('Audit log failed', e)
  }
}

export function handleError(e: unknown): NextResponse {
  logger.error('API error', e)
  if (e instanceof Error) return err(e.message, 500)
  return err('Internal server error', 500)
}
