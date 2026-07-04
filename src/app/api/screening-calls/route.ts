import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { movePipelineStage } from '@/lib/onboarding'

const callSchema = z.object({
  pipelineEntryId: z.string(),
  callDate: z.string().datetime().optional(),
  durationMinutes: z.number().min(1).max(240).optional().nullable(),
  notes: z.string().min(1),
  flagsDiscussed: z.array(z.string()).default([]),
  outcome: z.enum(['NO_DECISION', 'SHORTLIST', 'REJECT', 'NEEDS_FOLLOW_UP', 'INTERNAL_APPROVE']).default('NO_DECISION'),
  rejectedReason: z.string().optional().nullable(),
})

function stageForOutcome(outcome: string) {
  if (outcome === 'SHORTLIST') return 'SHORTLISTED'
  if (outcome === 'REJECT') return 'REJECTED'
  if (outcome === 'INTERNAL_APPROVE') return 'INTERNAL_APPROVED'
  return 'SCREENING_CALL'
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const data = callSchema.parse(await req.json())
    const entry = await prisma.pipelineEntry.findUnique({
      where: { id: data.pipelineEntryId },
      select: { id: true, stage: true },
    })
    if (!entry) return err('Pipeline entry not found', 404)

    const result = await prisma.$transaction(async (tx) => {
      const note = await tx.screeningCallNote.create({
        data: {
          pipelineEntryId: data.pipelineEntryId,
          calledById: session!.user.id,
          callDate: data.callDate ? new Date(data.callDate) : new Date(),
          durationMinutes: data.durationMinutes || undefined,
          notes: data.notes.trim(),
          flagsDiscussed: data.flagsDiscussed,
          outcome: data.outcome,
        },
      })

      const nextStage = stageForOutcome(data.outcome)
      await movePipelineStage(tx, entry, nextStage, session!.user.id, `Screening call outcome: ${data.outcome.replace(/_/g, ' ')}`)

      if (nextStage === 'REJECTED') {
        await tx.pipelineEntry.update({
          where: { id: data.pipelineEntryId },
          data: { rejectedReason: data.rejectedReason?.trim() || 'Rejected after HR screening call' },
        })
      }

      return note
    })

    await auditLog(session!.user.id, 'CREATE_SCREENING_CALL', 'PipelineEntry', data.pipelineEntryId, undefined, data, req)
    return ok(result, 201)
  } catch (e) { return handleError(e) }
}
