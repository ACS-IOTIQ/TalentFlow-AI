import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, paginatedOk, getPagination, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'
import { sendInterviewScheduledEmails } from '@/lib/email'
import { movePipelineStage } from '@/lib/onboarding'

const scheduleSchema = z.object({
  pipelineEntryId: z.string(),
  roundTemplateId: z.string().optional(),
  roundNumber: z.number().min(1).max(10),
  roundName: z.string().min(1).max(80).optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().min(15).max(240).default(60),
  location: z.string().optional().nullable(),
  videoLink: z.string().optional().nullable(),
  interviewerName: z.string().min(2),
  interviewerEmail: z.string().email(),
})

const feedbackSchema = z.object({
  technicalScore: z.number().min(1).max(10).optional(),
  communicationScore: z.number().min(1).max(10).optional(),
  cultureFitScore: z.number().min(1).max(10).optional(),
  overallScore: z.number().min(1).max(10).optional(),
  recommendation: z.enum(['strong_yes', 'yes', 'no', 'strong_no']).optional(),
  strengths: z.string().optional(),
  concerns: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { page, pageSize, skip } = getPagination(req.nextUrl)
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    const status = req.nextUrl.searchParams.get('status')
    const options = req.nextUrl.searchParams.get('options')

    if (options === 'true') {
      const entries = await prisma.pipelineEntry.findMany({
        where: { stage: { not: 'REJECTED' } },
        orderBy: { updatedAt: 'desc' },
        include: {
          candidate: { select: { id: true, fullName: true, email: true, currentTitle: true, isInternal: true } },
          jd: {
            select: {
              id: true,
              title: true,
              client: true,
              interviewRounds: { orderBy: { roundNumber: 'asc' } },
            },
          },
          interviews: { orderBy: { scheduledAt: 'desc' }, take: 1, select: { scheduledAt: true, status: true } },
        },
      })

      return ok({ entries })
    }

    const where = {
      ...(from && { scheduledAt: { gte: new Date(from) } }),
      ...(to && { scheduledAt: { lte: new Date(to) } }),
      ...(status && { status: status as any }),
    }

    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { scheduledAt: 'asc' },
        include: {
          pipelineEntry: {
            include: {
              candidate: { select: { id: true, fullName: true, email: true, currentTitle: true, isInternal: true } },
              jd: { select: { id: true, title: true, client: true } },
            },
          },
          roundTemplate: true,
          scheduledBy: { select: { name: true } },
          feedback: { include: { interviewer: { select: { name: true, avatarUrl: true } } } },
        },
      }),
      prisma.interview.count({ where }),
    ])

    return paginatedOk(interviews, total, page, pageSize)
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR', 'DIR_TECH'])
    if (error) return error

    const body = await req.json()
    const action = req.nextUrl.searchParams.get('action')

    if (action === 'feedback') {
      const { interviewId, ...feedbackData } = z.object({
        interviewId: z.string(),
        ...feedbackSchema.shape,
      }).parse(body)

      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        include: { pipelineEntry: { select: { id: true, stage: true } } },
      })
      if (!interview) return err('Interview not found', 404)

      const existing = await prisma.interviewFeedback.findFirst({
        where: { interviewId, interviewerId: session!.user.id },
      })
      const feedback = await prisma.$transaction(async (tx) => {
        const saved = existing
          ? await tx.interviewFeedback.update({
            where: { id: existing.id },
            data: { ...feedbackData, submittedAt: new Date() },
          })
          : await tx.interviewFeedback.create({
            data: {
              interviewId,
              interviewerId: session!.user.id,
              ...feedbackData,
              submittedAt: new Date(),
            },
          })

        await tx.interview.update({
          where: { id: interviewId },
          data: { status: 'COMPLETED' },
        })

        if (feedbackData.recommendation === 'strong_yes' || feedbackData.recommendation === 'yes') {
          await movePipelineStage(tx, interview.pipelineEntry, 'INTERNAL_APPROVED', session!.user.id, 'Interview feedback recommends moving forward')
        }
        if (feedbackData.recommendation === 'no' || feedbackData.recommendation === 'strong_no') {
          await tx.pipelineEntry.update({
            where: { id: interview.pipelineEntry.id },
            data: { rejectedReason: 'Rejected based on interview feedback' },
          })
          await movePipelineStage(tx, interview.pipelineEntry, 'REJECTED', session!.user.id, 'Interview feedback recommends rejection')
        }

        return saved
      })
      return ok(feedback, 201)
    }

    const data = scheduleSchema.parse(body)
    const pipelineEntry = await prisma.pipelineEntry.findUnique({
      where: { id: data.pipelineEntryId },
      select: {
        id: true,
        jdId: true,
        stage: true,
        candidate: { select: { fullName: true, email: true } },
        jd: { select: { title: true, client: true } },
      },
    })
    if (!pipelineEntry) return err('Pipeline entry not found', 404)

    const interview = await prisma.$transaction(async (tx) => {
      const roundName = data.roundName?.trim() || `Round ${data.roundNumber}`
      const roundTemplate = data.roundTemplateId
        ? await tx.interviewRoundTemplate.findUnique({ where: { id: data.roundTemplateId } })
        : await tx.interviewRoundTemplate.upsert({
          where: { jdId_roundNumber: { jdId: pipelineEntry.jdId, roundNumber: data.roundNumber } },
          update: {
            roundName,
            durationMinutes: data.durationMinutes,
          },
          create: {
            jdId: pipelineEntry.jdId,
            roundNumber: data.roundNumber,
            roundName,
            durationMinutes: data.durationMinutes,
          },
        })

      if (!roundTemplate || roundTemplate.jdId !== pipelineEntry.jdId) throw new Error('Invalid round template for selected JD')

      const created = await tx.interview.create({
        data: {
          pipelineEntryId: data.pipelineEntryId,
          roundTemplateId: roundTemplate.id,
          roundNumber: data.roundNumber,
          scheduledAt: new Date(data.scheduledAt),
          durationMinutes: data.durationMinutes,
          location: data.location?.trim() || null,
          videoLink: data.videoLink?.trim() || null,
          interviewerName: data.interviewerName.trim(),
          interviewerEmail: data.interviewerEmail.trim().toLowerCase(),
          scheduledById: session!.user.id,
        },
        include: {
          pipelineEntry: {
            include: {
              candidate: { select: { fullName: true, email: true } },
              jd: { select: { title: true, client: true } },
            },
          },
          roundTemplate: true,
        },
      })

      await tx.pipelineEntry.update({
        where: { id: data.pipelineEntryId },
        data: { stage: 'INTERVIEW_SCHEDULED' },
      })

      await tx.pipelineHistory.create({
        data: {
          pipelineEntryId: data.pipelineEntryId,
          fromStage: pipelineEntry.stage,
          toStage: 'INTERVIEW_SCHEDULED',
          changedById: session!.user.id,
          notes: `Interview scheduled: ${roundTemplate.roundName}`,
        },
      })

      return created
    })

    await auditLog(session!.user.id, 'SCHEDULE_INTERVIEW', 'Interview', interview.id, undefined, { roundNumber: data.roundNumber, roundName: interview.roundTemplate?.roundName }, req)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''
    await sendInterviewScheduledEmails({
      candidateName: pipelineEntry.candidate.fullName,
      candidateEmail: pipelineEntry.candidate.email,
      interviewerName: data.interviewerName.trim(),
      interviewerEmail: data.interviewerEmail.trim().toLowerCase(),
      jdTitle: pipelineEntry.jd.title,
      client: pipelineEntry.jd.client,
      roundLabel: interview.roundTemplate?.roundName || `Round ${data.roundNumber}`,
      scheduledAt: new Date(data.scheduledAt),
      durationMinutes: data.durationMinutes,
      location: data.location?.trim() || null,
      videoLink: data.videoLink?.trim() || null,
      assessmentUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/interviews?assessment=${interview.id}` : undefined,
    })
    return ok(interview, 201)
  } catch (e) { return handleError(e) }
}
