import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { deleteCandidatesCascade } from '@/lib/candidate-cascade'
import { z } from 'zod'

const updateSchema = z.object({
  employeeIdRef: z.string().min(2).optional(),
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  location: z.string().optional(),
  currentTitle: z.string().optional(),
  jdId: z.string().optional(),
  billingRate: z.number().nonnegative().optional(),
  acsMonthlyCost: z.number().nonnegative().optional(),
  diversionType: z.enum(['FULL', 'PARTIAL', 'TEMPORARY']).optional(),
  allocationPercent: z.number().min(1).max(100).optional(),
  availability: z.string().optional(),
  skills: z.string().optional(),
  diversionNotes: z.string().optional(),
  aiAssessment: z.any().optional(),
})

function cleanEmail(email?: string) {
  return email?.trim() || undefined
}

function mergeDiversion(existing: any, data: z.infer<typeof updateSchema>) {
  const parsedData = existing && typeof existing === 'object' ? existing : {}
  const currentDiversion = parsedData.diversion && typeof parsedData.diversion === 'object' ? parsedData.diversion : {}
  const billingRate = data.billingRate ?? Number(currentDiversion.billingRate || 0)
  const acsMonthlyCost = data.acsMonthlyCost ?? Number(currentDiversion.acsMonthlyCost || 0)

  return {
    ...parsedData,
    diversion: {
      ...currentDiversion,
      ...(data.billingRate !== undefined && { billingRate: data.billingRate }),
      ...(data.acsMonthlyCost !== undefined && { acsMonthlyCost: data.acsMonthlyCost }),
      ...(data.allocationPercent !== undefined && { allocationPercent: data.allocationPercent }),
      ...(data.availability !== undefined && { availability: data.availability || null }),
      ...(data.skills !== undefined && { skills: data.skills || null }),
      ...(data.aiAssessment !== undefined && { aiAssessment: data.aiAssessment || null }),
      monthlyMargin: billingRate - acsMonthlyCost,
      updatedAt: new Date().toISOString(),
    },
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR'])
    if (error) return error

    const data = updateSchema.parse(await req.json())
    const existing = await prisma.candidate.findUnique({
      where: { id: params.id },
      include: { pipelineEntries: { orderBy: { updatedAt: 'desc' }, take: 1 } },
    })
    if (!existing || !existing.isInternal) return err('Internal resource not found', 404)

    const updated = await prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.update({
        where: { id: params.id },
        data: {
          ...(data.fullName !== undefined && { fullName: data.fullName }),
          ...(data.email !== undefined && { email: cleanEmail(data.email) }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.location !== undefined && { location: data.location || null }),
          ...(data.currentTitle !== undefined && { currentTitle: data.currentTitle || null }),
          ...(data.employeeIdRef !== undefined && { employeeIdRef: data.employeeIdRef }),
          ...(data.acsMonthlyCost !== undefined && { acsMonthlyCost: data.acsMonthlyCost }),
          ...(data.diversionType !== undefined && { diversionType: data.diversionType }),
          ...(data.diversionNotes !== undefined && { diversionNotes: data.diversionNotes || null }),
          parsedData: mergeDiversion(existing.parsedData, data),
        },
      })

      if (data.jdId) {
        const pipelineEntry = await tx.pipelineEntry.upsert({
          where: { candidateId_jdId: { candidateId: params.id, jdId: data.jdId } },
          update: {
            screeningNotes: data.aiAssessment?.screeningNotes || undefined,
            matchScore: data.aiAssessment?.fitScore || undefined,
            compositeScore: data.aiAssessment?.fitScore || undefined,
          },
          create: {
            candidateId: params.id,
            jdId: data.jdId,
            stage: 'SCREENED',
            isShortlisted: true,
            screeningNotes: data.aiAssessment?.screeningNotes || 'Internal resource diversion updated',
            matchScore: data.aiAssessment?.fitScore || 90,
            compositeScore: data.aiAssessment?.fitScore || 90,
          },
        })

        await tx.pipelineHistory.create({
          data: {
            pipelineEntryId: pipelineEntry.id,
            toStage: pipelineEntry.stage,
            changedById: session!.user.id,
            notes: 'Internal resource details updated',
          },
        })
      }

      if (data.skills !== undefined) {
        await tx.candidateSkill.deleteMany({ where: { candidateId: params.id, isAiExtracted: false } })
        for (const skill of data.skills.split(',').map(skill => skill.trim()).filter(Boolean)) {
          await tx.candidateSkill.upsert({
            where: { candidateId_skillName: { candidateId: params.id, skillName: skill } },
            update: { isAiExtracted: false },
            create: { candidateId: params.id, skillName: skill, isAiExtracted: false },
          })
        }
      }

      return candidate
    })

    await auditLog(session!.user.id, 'UPDATE_INTERNAL_RESOURCE', 'Candidate', params.id, undefined, data, req)
    return ok(updated)
  } catch (e) { return handleError(e) }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR'])
    if (error) return error

    const existing = await prisma.candidate.findUnique({ where: { id: params.id } })
    if (!existing || !existing.isInternal) return err('Internal resource not found', 404)

    const { deletedIds, records } = await deleteCandidatesCascade([params.id])
    if (!deletedIds.length) return err('Internal resource not found', 404)

    await auditLog(session!.user.id, 'DELETE_INTERNAL_RESOURCE', 'Candidate', params.id, records[0], undefined, req)
    return ok({ deleted: true })
  } catch (e) { return handleError(e) }
}
