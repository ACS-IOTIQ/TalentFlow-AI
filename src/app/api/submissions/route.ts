import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, paginatedOk, getPagination, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'

const submitSchema = z.object({
  pipelineEntryId: z.string(),
  clientContact: z.string().optional(),
  clientNotes: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']),
  clientNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { page, pageSize, skip } = getPagination(req.nextUrl)
    const status = req.nextUrl.searchParams.get('status')

    const [submissions, total] = await Promise.all([
      prisma.clientSubmission.findMany({
        where: status ? { status: status as any } : {},
        skip,
        take: pageSize,
        orderBy: { submittedAt: 'desc' },
        include: {
          pipelineEntry: {
            include: {
              candidate: { select: { id: true, fullName: true, currentTitle: true, isInternal: true } },
              jd: { select: { id: true, title: true, client: true } },
            },
          },
          submittedBy: { select: { name: true, avatarUrl: true } },
        },
      }),
      prisma.clientSubmission.count({ where: status ? { status: status as any } : {} }),
    ])

    return paginatedOk(submissions, total, page, pageSize)
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH'])
    if (error) return error

    const body = await req.json()
    const data = submitSchema.parse(body)

    const existing = await prisma.clientSubmission.findFirst({
      where: { pipelineEntryId: data.pipelineEntryId, status: { not: 'REJECTED' } },
    })
    if (existing) return err('Candidate already submitted', 409)

    const submission = await prisma.clientSubmission.create({
      data: {
        ...data,
        submittedById: session!.user.id,
        status: 'SUBMITTED',
      },
      include: {
        pipelineEntry: {
          include: {
            candidate: { select: { fullName: true } },
            jd: { select: { title: true } },
          },
        },
      },
    })

    await prisma.pipelineEntry.update({
      where: { id: data.pipelineEntryId },
      data: { stage: 'SUBMITTED_TO_CLIENT' },
    })

    await auditLog(session!.user.id, 'SUBMIT_TO_CLIENT', 'ClientSubmission', submission.id, undefined, data, req)
    return ok(submission, 201)
  } catch (e) { return handleError(e) }
}
