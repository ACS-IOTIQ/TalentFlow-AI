import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { notifyUser } from '@/lib/notifications'

const stageSchema = z.object({
  stage: z.enum([
    'NEW',
    'PROFILE_COMPLETE',
    'SCREENING',
    'SCREENED',
    'SHORTLISTED',
    'SCREENING_CALL',
    'INTERVIEW_SCHEDULED',
    'INTERVIEWING',
    'INTERNAL_APPROVED',
    'SUBMITTED_TO_CLIENT',
    'CLIENT_INTERVIEW',
    'OFFERED',
    'CLIENT_APPROVED',
    'CLIENT_REJECTED',
    'ONBOARDING',
    'ONBOARDED',
    'REJECTED',
  ]),
  notes: z.string().optional().nullable(),
  rejectedReason: z.string().optional().nullable(),
})

function cleanText(value?: string | null) {
  return value?.trim() || null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const data = stageSchema.parse(await req.json())
    const existing = await prisma.pipelineEntry.findUnique({
      where: { id: params.id },
      include: {
        candidate: { select: { fullName: true } },
        jd: { select: { title: true } },
      },
    })
    if (!existing) return err('Pipeline entry not found', 404)

    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.pipelineEntry.update({
        where: { id: params.id },
        data: {
          stage: data.stage,
          isShortlisted: ['SCREENED', 'SHORTLISTED', 'INTERNAL_APPROVED'].includes(data.stage),
          rejectedReason: data.stage === 'REJECTED' || data.stage === 'CLIENT_REJECTED'
            ? cleanText(data.rejectedReason) || existing.rejectedReason
            : null,
        },
        include: {
          candidate: { select: { id: true, fullName: true, email: true, isInternal: true } },
          jd: { select: { id: true, title: true, client: true } },
          history: { orderBy: { createdAt: 'desc' }, take: 10, include: { changedBy: { select: { name: true } } } },
        },
      })

      await tx.pipelineHistory.create({
        data: {
          pipelineEntryId: params.id,
          fromStage: existing.stage,
          toStage: data.stage,
          changedById: session!.user.id,
          notes: cleanText(data.notes) || `Manual stage move to ${data.stage.replace(/_/g, ' ')}`,
        },
      })

      return entry
    })

    await notifyUser({
      userId: session!.user.id,
      title: 'Pipeline updated',
      message: `${existing.candidate.fullName} moved to ${data.stage.replace(/_/g, ' ')} for ${existing.jd.title}.`,
      type: 'SUCCESS',
      link: `/candidates/${updated.candidate.id}`,
    })
    await auditLog(session!.user.id, 'MOVE_PIPELINE_STAGE', 'PipelineEntry', params.id, existing, data, req)
    return ok(updated)
  } catch (e) { return handleError(e) }
}
