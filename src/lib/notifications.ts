import { prisma } from '@/lib/db'

export async function notifyUser({
  userId,
  title,
  message,
  type = 'INFO',
  link,
}: {
  userId?: string | null
  title: string
  message: string
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  link?: string
}) {
  if (!userId) return
  await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      link,
    },
  })
}
