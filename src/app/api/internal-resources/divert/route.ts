import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, auditLog, handleError } from '@/lib/api-utils'
import { z } from 'zod'

const divertSchema = z.object({
  employeeIdRef: z.string(),
  fullName: z.string(),
  email: z.string().email().optional(),
  currentTitle: z.string().optional(),
  jdId: z.string(),
  billingRate: z.number(),
  acsMonthlyCost: z.number(),
  diversionType: z.enum(['FULL', 'PARTIAL', 'TEMPORARY']),
  diversionNotes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR'])
    if (error) return error

    const data = divertSchema.parse(await req.json())
    const candidate = await prisma.candidate.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        currentTitle: data.currentTitle,
        currentCompany: 'ACS Technologies',
        source: 'Internal',
        isInternal: true,
        employeeIdRef: data.employeeIdRef,
        acsMonthlyCost: data.acsMonthlyCost,
        diversionType: data.diversionType,
        diversionNotes: data.diversionNotes,
        parsedData: {
          diversion: {
            billingRate: data.billingRate,
            acsMonthlyCost: data.acsMonthlyCost,
            allocationPercent: data.diversionType === 'PARTIAL' ? 50 : 100,
            monthlyMargin: data.billingRate - data.acsMonthlyCost,
            updatedAt: new Date().toISOString(),
          },
        },
        diversionInitiatedById: session!.user.id,
        diversionInitiatedAt: new Date(),
        pipelineEntries: {
          create: {
            jdId: data.jdId,
            stage: 'SCREENED',
            isShortlisted: true,
            matchScore: 90,
            compositeScore: 90,
            screeningNotes: 'Internal resource diversion approved by CSO',
          },
        },
      },
      include: {
        pipelineEntries: { include: { jd: { select: { title: true } } } },
      },
    })

    await auditLog(session!.user.id, 'DIVERT_RESOURCE', 'Candidate', candidate.id, undefined, data, req)
    return ok(candidate, 201)
  } catch (e) { return handleError(e) }
}
