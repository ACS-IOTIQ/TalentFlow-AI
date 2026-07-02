import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { deleteCandidatesCascade } from '@/lib/candidate-cascade'
import { z } from 'zod'

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  currentTitle: z.string().optional().nullable(),
  currentCompany: z.string().optional().nullable(),
  totalExperienceYears: z.number().optional().nullable(),
  noticePeriodDays: z.number().optional().nullable(),
  expectedSalary: z.number().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
})

function cleanText(value?: string | null) {
  return value?.trim() || null
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        skills: { orderBy: { skillName: 'asc' } },
        redFlags: { orderBy: { severity: 'asc' } },
        pipelineEntries: {
          include: {
            jd: { select: { id: true, title: true, client: true } },
            history: { orderBy: { createdAt: 'desc' }, take: 20, include: { changedBy: { select: { name: true } } } },
            screeningCalls: { orderBy: { createdAt: 'desc' } },
            interviews: {
              orderBy: { scheduledAt: 'desc' },
              include: {
                roundTemplate: true,
                feedback: { include: { interviewer: { select: { name: true } } } },
              },
            },
            submissions: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    })
    if (!candidate) return err('Candidate not found', 404)
    return ok(candidate)
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR', 'DIR_TECH'])
    if (error) return error

    const body = await req.json()
    const data = updateSchema.parse(body)

    const candidate = await prisma.candidate.update({
      where: { id: params.id },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName.trim() }),
        ...(data.email !== undefined && { email: cleanText(data.email) }),
        ...(data.phone !== undefined && { phone: cleanText(data.phone) }),
        ...(data.location !== undefined && { location: cleanText(data.location) }),
        ...(data.currentTitle !== undefined && { currentTitle: cleanText(data.currentTitle) }),
        ...(data.currentCompany !== undefined && { currentCompany: cleanText(data.currentCompany) }),
        ...(data.totalExperienceYears !== undefined && { totalExperienceYears: data.totalExperienceYears }),
        ...(data.noticePeriodDays !== undefined && { noticePeriodDays: data.noticePeriodDays }),
        ...(data.expectedSalary !== undefined && { expectedSalary: data.expectedSalary }),
        ...(data.linkedinUrl !== undefined && { linkedinUrl: cleanText(data.linkedinUrl) }),
      } as any,
    })

    await auditLog(session!.user.id, 'UPDATE_CANDIDATE', 'Candidate', params.id, undefined, data, req)
    return ok(candidate)
  } catch (e) { return handleError(e) }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR', 'DIR_TECH'])
    if (error) return error

    const { deletedIds, records } = await deleteCandidatesCascade([params.id])
    if (!deletedIds.length) return err('Candidate not found', 404)

    await auditLog(session!.user.id, 'DELETE_CANDIDATE', 'Candidate', params.id, records[0], undefined, req)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
