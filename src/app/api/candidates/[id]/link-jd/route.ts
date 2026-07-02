import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'

const linkJdSchema = z.object({
  jdId: z.string().min(1),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR', 'DIR_TECH'])
    if (error) return error

    const { jdId } = linkJdSchema.parse(await req.json())
    const [candidate, jd] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: params.id }, select: { id: true } }),
      prisma.jobDescription.findUnique({ where: { id: jdId }, select: { id: true } }),
    ])
    if (!candidate) return err('Candidate not found', 404)
    if (!jd) return err('JD not found', 404)

    const pipelineEntry = await prisma.$transaction(async (tx) => {
      const entry = await tx.pipelineEntry.upsert({
        where: { candidateId_jdId: { candidateId: params.id, jdId } },
        update: {},
        create: { candidateId: params.id, jdId, stage: 'NEW' },
      })

      await tx.pipelineHistory.create({
        data: {
          pipelineEntryId: entry.id,
          toStage: entry.stage,
          changedById: session!.user.id,
          notes: 'Candidate linked to JD',
        },
      })

      return entry
    })

    await auditLog(session!.user.id, 'LINK_CANDIDATE_JD', 'Candidate', params.id, undefined, { jdId }, req)
    return ok(pipelineEntry)
  } catch (e) { return handleError(e) }
}
