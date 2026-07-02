import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, handleError } from '@/lib/api-utils'
import { polishJobDescription } from '@/lib/ai/screening'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH'])
    if (error) return error

    const jd = await prisma.jobDescription.findUnique({ where: { id: params.id } })
    if (!jd) return err('JD not found', 404)
    if (!jd.rawContent) return err('No raw content to polish', 400)

    await prisma.jobDescription.update({ where: { id: params.id }, data: { status: 'POLISHING' } })

    const polished = await polishJobDescription(jd.rawContent)

    const updated = await prisma.jobDescription.update({
      where: { id: params.id },
      data: {
        polishedContent: polished,
        finalContent: polished,
        status: 'POLISHED',
        polishedById: session!.user.id,
      },
    })

    return ok(updated)
  } catch (e) { return handleError(e) }
}
