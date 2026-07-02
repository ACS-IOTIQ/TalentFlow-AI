import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']),
  clientNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH'])
    if (error) return error

    const body = await req.json()
    const data = updateStatusSchema.parse(body)

    const submission = await prisma.clientSubmission.update({
      where: { id: params.id },
      data: {
        status: data.status,
        clientNotes: data.clientNotes,
        rejectionReason: data.rejectionReason,
        ...(data.status === 'APPROVED' && { approvedAt: new Date() }),
        ...(data.status === 'REJECTED' && { rejectedAt: new Date() }),
      },
      include: { pipelineEntry: true },
    })

    const stageMap = {
      APPROVED: 'CLIENT_APPROVED' as const,
      REJECTED: 'CLIENT_REJECTED' as const,
    }
    if (stageMap[data.status as keyof typeof stageMap]) {
      await prisma.pipelineEntry.update({
        where: { id: submission.pipelineEntryId },
        data: { stage: stageMap[data.status as keyof typeof stageMap] },
      })
    }

    await auditLog(session!.user.id, 'UPDATE_SUBMISSION_STATUS', 'ClientSubmission', params.id, undefined, data, req)
    return ok(submission)
  } catch (e) { return handleError(e) }
}
