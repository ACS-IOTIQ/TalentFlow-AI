import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { movePipelineStage } from '@/lib/onboarding'
import { sendInterviewUpdatedEmails } from '@/lib/email'
import { notifyUser } from '@/lib/notifications'

const updateInterviewSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().min(15).max(240).optional(),
  location: z.string().optional().nullable(),
  videoLink: z.string().optional().nullable(),
  interviewerName: z.string().min(2).optional(),
  interviewerEmail: z.string().email().optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().optional().nullable(),
})

function cleanText(value?: string | null) {
  return value?.trim() || null
}

function pipelineStageForStatus(status?: string) {
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'SCREENING_CALL'
  if (status === 'COMPLETED') return 'INTERVIEWING'
  return 'INTERVIEW_SCHEDULED'
}

function updateTypeFrom(data: z.infer<typeof updateInterviewSchema>) {
  if (data.status === 'CANCELLED') return 'CANCELLED' as const
  if (data.status === 'NO_SHOW') return 'NO_SHOW' as const
  if (data.status === 'COMPLETED') return 'COMPLETED' as const
  return data.scheduledAt ? 'RESCHEDULED' as const : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const data = updateInterviewSchema.parse(await req.json())
    const existing = await prisma.interview.findUnique({
      where: { id: params.id },
      include: {
        roundTemplate: true,
        pipelineEntry: {
          select: {
            id: true,
            stage: true,
            candidate: { select: { id: true, fullName: true, email: true } },
            jd: { select: { title: true, client: true } },
          },
        },
      },
    })
    if (!existing) return err('Interview not found', 404)

    const nextStatus = data.status || (data.scheduledAt ? 'SCHEDULED' : existing.status)
    const updateType = updateTypeFrom(data)
    const interview = await prisma.$transaction(async (tx) => {
      const updated = await tx.interview.update({
        where: { id: params.id },
        data: {
          ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
          ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
          ...(data.location !== undefined && { location: cleanText(data.location) }),
          ...(data.videoLink !== undefined && { videoLink: cleanText(data.videoLink) }),
          ...(data.interviewerName !== undefined && { interviewerName: data.interviewerName.trim() }),
          ...(data.interviewerEmail !== undefined && { interviewerEmail: data.interviewerEmail.trim().toLowerCase() }),
          status: nextStatus,
        },
        include: {
          roundTemplate: true,
          pipelineEntry: {
            include: {
              candidate: { select: { id: true, fullName: true, email: true } },
              jd: { select: { id: true, title: true, client: true } },
            },
          },
        },
      })

      const nextStage = pipelineStageForStatus(nextStatus)
      await movePipelineStage(
        tx,
        existing.pipelineEntry,
        nextStage,
        session!.user.id,
        cleanText(data.notes) || `Interview ${updateType?.replace(/_/g, ' ').toLowerCase() || 'updated'}`,
      )

      return updated
    })

    if (updateType) {
      await sendInterviewUpdatedEmails({
        candidateName: interview.pipelineEntry.candidate.fullName,
        candidateEmail: interview.pipelineEntry.candidate.email,
        interviewerName: interview.interviewerName || data.interviewerName || 'Interviewer',
        interviewerEmail: interview.interviewerEmail || data.interviewerEmail || session!.user.email,
        jdTitle: interview.pipelineEntry.jd.title,
        client: interview.pipelineEntry.jd.client,
        roundLabel: interview.roundTemplate?.roundName || `Round ${interview.roundNumber}`,
        scheduledAt: interview.scheduledAt,
        durationMinutes: interview.durationMinutes,
        location: interview.location,
        videoLink: interview.videoLink,
      }, updateType)
    }

    await notifyUser({
      userId: session!.user.id,
      title: 'Interview updated',
      message: `${interview.pipelineEntry.candidate.fullName} interview is now ${nextStatus.replace(/_/g, ' ')}.`,
      type: nextStatus === 'CANCELLED' ? 'WARNING' : 'INFO',
      link: `/interviews?assessment=${interview.id}`,
    })
    await auditLog(session!.user.id, 'UPDATE_INTERVIEW', 'Interview', params.id, existing, data, req)
    return ok(interview)
  } catch (e) { return handleError(e) }
}
