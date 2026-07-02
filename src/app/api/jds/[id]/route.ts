import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'

const updateJDSchema = z.object({
  title: z.string().min(2).optional(),
  finalContent: z.string().optional(),
  polishedContent: z.string().optional(),
  rawContent: z.string().optional(),
  status: z.enum(['RAW', 'POLISHING', 'POLISHED', 'POSTED', 'CLOSED']).optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  experienceMin: z.number().optional().nullable(),
  experienceMax: z.number().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  openings: z.number().min(1).optional(),
  requiredSkills: z.array(z.string()).optional(),
  client: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const jd = await prisma.jobDescription.findUnique({
      where: { id: params.id },
      include: {
        createdBy: { select: { name: true, avatarUrl: true } },
        polishedBy: { select: { name: true } },
        postingSources: true,
        screeningConfig: true,
        interviewRounds: { orderBy: { roundNumber: 'asc' } },
        _count: { select: { pipelineEntries: true } },
      },
    })
    if (!jd) return err('JD not found', 404)
    return ok(jd)
  } catch (e) { return handleError(e) }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH'])
    if (error) return error

    const body = await req.json()
    const data = updateJDSchema.parse(body)

    const jd = await prisma.jobDescription.update({
      where: { id: params.id },
      data: data as any,
      include: {
        createdBy: { select: { name: true, avatarUrl: true } },
        polishedBy: { select: { name: true } },
        postingSources: true,
        screeningConfig: true,
        interviewRounds: { orderBy: { roundNumber: 'asc' } },
        _count: { select: { pipelineEntries: true } },
      },
    })

    await auditLog(session!.user.id, 'UPDATE_JD', 'JobDescription', params.id, undefined, data, req)
    return ok(jd)
  } catch (e) { return handleError(e) }
}

// DELETE with ?permanent=true → hard delete (SUPER_ADMIN only)
// DELETE without flag → soft close (SUPER_ADMIN, CSO)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const permanent = req.nextUrl.searchParams.get('permanent') === 'true'

    if (permanent) {
      const { error, session } = await requireAuth(['SUPER_ADMIN'])
      if (error) return error

      // Check for dependent pipeline entries before hard delete
      const deps = await prisma.pipelineEntry.count({ where: { jdId: params.id } })
      if (deps > 0) {
        return err(`Cannot permanently delete: ${deps} candidate(s) are in this JD's pipeline. Close it instead.`, 409)
      }

      await prisma.jobDescription.delete({ where: { id: params.id } })
      await auditLog(session!.user.id, 'DELETE_JD', 'JobDescription', params.id, undefined, undefined, req)
      return ok({ message: 'JD permanently deleted' })
    }

    // Soft close
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO'])
    if (error) return error

    await prisma.jobDescription.update({
      where: { id: params.id },
      data: { status: 'CLOSED' },
    })
    await auditLog(session!.user.id, 'CLOSE_JD', 'JobDescription', params.id, undefined, undefined, req)
    return ok({ message: 'JD closed' })
  } catch (e) { return handleError(e) }
}
