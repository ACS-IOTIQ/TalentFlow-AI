import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { movePipelineStage } from '@/lib/onboarding'

const submitInternalSchema = z.object({
  jdId: z.string().min(1),
  clientContact: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
})

const activeSubmissionStatuses = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'CLIENT_INTERVIEW_SCHEDULED',
  'CLIENT_INTERVIEW_COMPLETED',
  'CLIENT_SELECTED',
  'OFFER_RELEASED',
  'APPROVED',
] as const

function cleanText(value?: string | null) {
  return value?.trim() || null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR'])
    if (error) return error

    const data = submitInternalSchema.parse(await req.json())
    const [candidate, jd] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: params.id }, select: { id: true, isInternal: true } }),
      prisma.jobDescription.findUnique({ where: { id: data.jdId }, select: { id: true } }),
    ])
    if (!candidate || !candidate.isInternal) return err('Internal resource not found', 404)
    if (!jd) return err('JD not found', 404)

    const existingActive = await prisma.clientSubmission.findFirst({
      where: {
        pipelineEntry: { candidateId: params.id, jdId: data.jdId },
        status: { in: [...activeSubmissionStatuses] as any },
      },
    })
    if (existingActive) return err('Internal resource already has an active submission for this JD', 409)

    const submission = await prisma.$transaction(async (tx) => {
      const entry = await tx.pipelineEntry.upsert({
        where: { candidateId_jdId: { candidateId: params.id, jdId: data.jdId } },
        update: { stage: 'INTERNAL_APPROVED', isShortlisted: true },
        create: {
          candidateId: params.id,
          jdId: data.jdId,
          stage: 'INTERNAL_APPROVED',
          isShortlisted: true,
          screeningNotes: 'Internal resource approved for direct client submission',
        },
      })

      await tx.pipelineHistory.create({
        data: {
          pipelineEntryId: entry.id,
          toStage: 'INTERNAL_APPROVED',
          changedById: session!.user.id,
          notes: 'Internal resource approved for direct submission',
        },
      })

      const created = await tx.clientSubmission.create({
        data: {
          pipelineEntryId: entry.id,
          submittedById: session!.user.id,
          status: 'SUBMITTED',
          clientContact: cleanText(data.clientContact),
          clientNotes: cleanText(data.clientNotes) || 'Direct internal resource submission',
        },
        include: {
          pipelineEntry: {
            include: {
              candidate: { select: { id: true, fullName: true, isInternal: true } },
              jd: { select: { id: true, title: true, client: true } },
            },
          },
          submittedBy: { select: { id: true, name: true } },
        },
      })

      await movePipelineStage(tx, entry, 'SUBMITTED_TO_CLIENT', session!.user.id, 'Internal resource submitted to client')
      return created
    })

    await auditLog(session!.user.id, 'SUBMIT_INTERNAL_RESOURCE_TO_CLIENT', 'Candidate', params.id, undefined, data, req)
    return ok(submission, 201)
  } catch (e) { return handleError(e) }
}
