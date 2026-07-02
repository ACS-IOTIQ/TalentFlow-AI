import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, handleError } from '@/lib/api-utils'

export async function GET(_req: NextRequest) {
  try {
    const { error, session } = await requireAuth()
    if (error) return error

    const notifications = await prisma.notification.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: session!.user.id, isRead: false },
    })

    return ok({ notifications, unreadCount })
  } catch (e) { return handleError(e) }
}

export async function PATCH(_req: NextRequest) {
  try {
    const { error, session } = await requireAuth()
    if (error) return error

    await prisma.notification.updateMany({
      where: { userId: session!.user.id, isRead: false },
      data: { isRead: true },
    })

    return ok({ message: 'All marked as read' })
  } catch (e) { return handleError(e) }
}
