import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { cleanText, ensureOnboardingChecklist, movePipelineStage } from '@/lib/onboarding'
import { z } from 'zod'

const updateSubmissionSchema = z.object({
  action: z.enum(['START_ONBOARDING']).optional(),
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  clientContact: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  profilePdfKey: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
})

const activeSubmissionStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] as const

function submissionInclude() {
  return {
    pipelineEntry: {
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            email: true,
            currentTitle: true,
            currentCompany: true,
            isInternal: true,
          },
        },
        jd: { select: { id: true, title: true, client: true } },
      },
    },
    submittedBy: { select: { id: true, name: true, avatarUrl: true } },
  }
}

function stageForStatus(status: string) {
  if (status === 'APPROVED') return 'CLIENT_APPROVED'
  if (status === 'REJECTED') return 'CLIENT_REJECTED'
  return 'SUBMITTED_TO_CLIENT'
}

function notesForStatus(status: string) {
  if (status === 'UNDER_REVIEW') return 'Tahaluf submission marked under review'
  if (status === 'APPROVED') return 'Tahaluf submission approved'
  if (status === 'REJECTED') return 'Tahaluf submission rejected'
  return 'Tahaluf submission marked submitted'
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const submission = await prisma.clientSubmission.findUnique({
      where: { id: params.id },
      include: submissionInclude(),
    })
    if (!submission) return err('Submission not found', 404)
    return ok(submission)
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const data = updateSubmissionSchema.parse(await req.json())
    const existing = await prisma.clientSubmission.findUnique({
      where: { id: params.id },
      include: { pipelineEntry: { select: { id: true, stage: true } } },
    })
    if (!existing) return err('Submission not found', 404)

    if (data.action === 'START_ONBOARDING') {
      if (existing.status !== 'APPROVED') return err('Only approved submissions can start onboarding', 400)

      const result = await prisma.$transaction(async (tx) => {
        const checklist = await ensureOnboardingChecklist(tx, existing.pipelineEntryId, session!.user.id, new Date())
        await movePipelineStage(tx, existing.pipelineEntry, 'ONBOARDING', session!.user.id, 'Onboarding started from Tahaluf approval')
        return checklist
      })

      await auditLog(session!.user.id, 'START_ONBOARDING', 'ClientSubmission', params.id, undefined, data, req)
      return ok(result)
    }

    const nextStatus = data.status || existing.status
    const statusChanged = Boolean(data.status && data.status !== existing.status)
    const updateData = {
      ...(data.status && { status: data.status }),
      ...(data.clientContact !== undefined && { clientContact: cleanText(data.clientContact) }),
      ...(data.clientNotes !== undefined && { clientNotes: cleanText(data.clientNotes) }),
      ...(data.profilePdfKey !== undefined && { profilePdfKey: cleanText(data.profilePdfKey) }),
      ...(statusChanged && data.status === 'APPROVED' && { approvedAt: new Date(), rejectedAt: null, rejectionReason: null }),
      ...(statusChanged && data.status === 'REJECTED' && { rejectedAt: new Date(), approvedAt: null, rejectionReason: cleanText(data.rejectionReason) }),
      ...(statusChanged && data.status !== 'REJECTED' && { rejectedAt: null, rejectionReason: null }),
      ...(statusChanged && data.status !== 'APPROVED' && { approvedAt: null }),
      ...(data.rejectionReason !== undefined && nextStatus === 'REJECTED' && { rejectionReason: cleanText(data.rejectionReason) }),
    }

    const submission = await prisma.$transaction(async (tx) => {
      const updated = await tx.clientSubmission.update({
        where: { id: params.id },
        data: updateData,
        include: submissionInclude(),
      })

      if (statusChanged && data.status) {
        await movePipelineStage(tx, existing.pipelineEntry, stageForStatus(data.status), session!.user.id, notesForStatus(data.status))
        if (data.status === 'APPROVED') {
          await ensureOnboardingChecklist(tx, existing.pipelineEntryId, session!.user.id)
        }
      }

      return updated
    })

    await auditLog(session!.user.id, 'UPDATE_SUBMISSION', 'ClientSubmission', params.id, existing, data, req)
    return ok(submission)
  } catch (e) { return handleError(e) }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const existing = await prisma.clientSubmission.findUnique({
      where: { id: params.id },
      include: { pipelineEntry: { select: { id: true, stage: true } } },
    })
    if (!existing) return err('Submission not found', 404)

    await prisma.$transaction(async (tx) => {
      await tx.clientSubmission.delete({ where: { id: params.id } })

      if (activeSubmissionStatuses.includes(existing.status as any)) {
        const remainingActive = await tx.clientSubmission.count({
          where: {
            pipelineEntryId: existing.pipelineEntryId,
            status: { in: [...activeSubmissionStatuses] as any },
          },
        })

        if (!remainingActive) {
          await movePipelineStage(tx, existing.pipelineEntry, 'INTERNAL_APPROVED', session!.user.id, 'Active Tahaluf submission deleted')
        }
      }
    })

    await auditLog(session!.user.id, 'DELETE_SUBMISSION', 'ClientSubmission', params.id, existing, undefined, req)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
