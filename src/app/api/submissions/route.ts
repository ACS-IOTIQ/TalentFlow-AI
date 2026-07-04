import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, getPagination, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'

const submitSchema = z.object({
  pipelineEntryId: z.string(),
  clientContact: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  profilePdfKey: z.string().optional().nullable(),
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
const allowedSubmitStages = ['SHORTLISTED', 'SCREENED', 'INTERNAL_APPROVED', 'SCREENING_CALL', 'INTERVIEWING', 'INTERVIEW_SCHEDULED', 'CLIENT_REJECTED', 'OFFERED'] as const

function cleanText(value?: string | null) {
  return value?.trim() || null
}

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

async function movePipelineStage(tx: any, pipelineEntry: { id: string; stage: string }, toStage: string, userId: string, notes: string) {
  if (pipelineEntry.stage === toStage) return
  await tx.pipelineEntry.update({
    where: { id: pipelineEntry.id },
    data: { stage: toStage },
  })
  await tx.pipelineHistory.create({
    data: {
      pipelineEntryId: pipelineEntry.id,
      fromStage: pipelineEntry.stage,
      toStage,
      changedById: userId,
      notes,
    },
  })
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const options = req.nextUrl.searchParams.get('options')
    if (options === 'true') {
      const entries = await prisma.pipelineEntry.findMany({
        where: {
          stage: { in: [...allowedSubmitStages] as any },
          submissions: { none: { status: { in: [...activeSubmissionStatuses] as any } } },
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          candidate: { select: { id: true, fullName: true, email: true, currentTitle: true, isInternal: true } },
          jd: { select: { id: true, title: true, client: true } },
        },
      })
      return ok({ entries })
    }

    const { page, pageSize, skip } = getPagination(req.nextUrl)
    const status = req.nextUrl.searchParams.get('status')
    const search = req.nextUrl.searchParams.get('search')?.trim()

    const where = {
      ...(status && { status: status as any }),
      ...(search && {
        OR: [
          { clientContact: { contains: search, mode: 'insensitive' as const } },
          { clientNotes: { contains: search, mode: 'insensitive' as const } },
          {
            pipelineEntry: {
              candidate: {
                OR: [
                  { fullName: { contains: search, mode: 'insensitive' as const } },
                  { email: { contains: search, mode: 'insensitive' as const } },
                  { currentTitle: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            },
          },
          {
            pipelineEntry: {
              jd: {
                OR: [
                  { title: { contains: search, mode: 'insensitive' as const } },
                  { client: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            },
          },
        ],
      }),
    }

    const [submissions, total, counts] = await Promise.all([
      prisma.clientSubmission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { submittedAt: 'desc' },
        include: submissionInclude(),
      }),
      prisma.clientSubmission.count({ where }),
      prisma.clientSubmission.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: submissions,
      counts,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const data = submitSchema.parse(await req.json())
    const pipelineEntry = await prisma.pipelineEntry.findUnique({
      where: { id: data.pipelineEntryId },
      select: { id: true, stage: true },
    })
    if (!pipelineEntry) return err('Pipeline entry not found', 404)

    const existing = await prisma.clientSubmission.findFirst({
      where: { pipelineEntryId: data.pipelineEntryId, status: { in: [...activeSubmissionStatuses] as any } },
    })
    if (existing) return err('Candidate already has an active submission', 409)

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.clientSubmission.create({
        data: {
          pipelineEntryId: data.pipelineEntryId,
          submittedById: session!.user.id,
          status: 'SUBMITTED',
          clientContact: cleanText(data.clientContact),
          clientNotes: cleanText(data.clientNotes),
          profilePdfKey: cleanText(data.profilePdfKey),
        },
        include: submissionInclude(),
      })

      await movePipelineStage(tx, pipelineEntry, 'SUBMITTED_TO_CLIENT', session!.user.id, 'Submitted to Tahaluf')
      return created
    })

    await auditLog(session!.user.id, 'SUBMIT_TO_CLIENT', 'ClientSubmission', submission.id, undefined, data, req)
    return ok(submission, 201)
  } catch (e) { return handleError(e) }
}
