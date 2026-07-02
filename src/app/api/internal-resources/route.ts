import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { assessInternalResource } from '@/lib/ai/internal-resource'
import { z } from 'zod'

const resourceSchema = z.object({
  employeeIdRef: z.string().min(2),
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  location: z.string().optional(),
  currentTitle: z.string().optional(),
  skills: z.string().optional(),
  jdId: z.string().min(1),
  billingRate: z.number().nonnegative(),
  acsMonthlyCost: z.number().nonnegative(),
  diversionType: z.enum(['FULL', 'PARTIAL', 'TEMPORARY']),
  allocationPercent: z.number().min(1).max(100).default(100),
  availability: z.string().optional(),
  diversionNotes: z.string().optional(),
  aiAssessment: z.any().optional(),
})

const assessSchema = resourceSchema.partial().extend({
  jdId: z.string().min(1),
})

function cleanEmail(email?: string) {
  return email?.trim() || undefined
}

function buildParsedData(data: z.infer<typeof resourceSchema>, existing?: any) {
  return {
    ...(existing && typeof existing === 'object' ? existing : {}),
    diversion: {
      billingRate: data.billingRate,
      acsMonthlyCost: data.acsMonthlyCost,
      allocationPercent: data.allocationPercent,
      availability: data.availability || null,
      skills: data.skills || null,
      monthlyMargin: data.billingRate - data.acsMonthlyCost,
      aiAssessment: data.aiAssessment || null,
      updatedAt: new Date().toISOString(),
    },
  }
}

export async function GET() {
  try {
    const { error } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR', 'DIR_TECH'])
    if (error) return error

    const resources = await prisma.candidate.findMany({
      where: { isInternal: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        skills: true,
        pipelineEntries: {
          include: {
            jd: { select: { id: true, title: true, client: true } },
            history: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    })

    return ok(resources)
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR'])
    if (error) return error

    const action = req.nextUrl.searchParams.get('action')

    if (action === 'assess') {
      const body = assessSchema.parse(await req.json())
      const jd = await prisma.jobDescription.findUnique({
        where: { id: body.jdId },
        select: { title: true, rawContent: true, polishedContent: true, finalContent: true, requiredSkills: true },
      })
      if (!jd) return err('JD not found', 404)

      const assessment = await assessInternalResource({
        ...body,
        jdTitle: jd.title,
        jdContent: jd.finalContent || jd.polishedContent || jd.rawContent,
        jdSkills: jd.requiredSkills,
      })
      return ok(assessment)
    }

    const data = resourceSchema.parse(await req.json())
    const existing = cleanEmail(data.email)
      ? await prisma.candidate.findFirst({ where: { email: { equals: cleanEmail(data.email), mode: 'insensitive' } } })
      : await prisma.candidate.findFirst({ where: { employeeIdRef: data.employeeIdRef } })

    const candidate = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.candidate.update({
          where: { id: existing.id },
          data: {
            fullName: data.fullName,
            email: cleanEmail(data.email),
            phone: data.phone || undefined,
            location: data.location || undefined,
            currentTitle: data.currentTitle || undefined,
            currentCompany: 'ACS Technologies',
            source: 'Internal',
            isInternal: true,
            employeeIdRef: data.employeeIdRef,
            acsMonthlyCost: data.acsMonthlyCost,
            diversionType: data.diversionType,
            diversionNotes: data.diversionNotes,
            diversionInitiatedById: session!.user.id,
            diversionInitiatedAt: new Date(),
            parsedData: buildParsedData(data, existing.parsedData),
          },
        })
        : await tx.candidate.create({
          data: {
            fullName: data.fullName,
            email: cleanEmail(data.email),
            phone: data.phone || undefined,
            location: data.location || undefined,
            currentTitle: data.currentTitle || undefined,
            currentCompany: 'ACS Technologies',
            source: 'Internal',
            isInternal: true,
            employeeIdRef: data.employeeIdRef,
            acsMonthlyCost: data.acsMonthlyCost,
            diversionType: data.diversionType,
            diversionNotes: data.diversionNotes,
            diversionInitiatedById: session!.user.id,
            diversionInitiatedAt: new Date(),
            parsedData: buildParsedData(data),
          },
        })

      const pipelineEntry = await tx.pipelineEntry.upsert({
        where: { candidateId_jdId: { candidateId: saved.id, jdId: data.jdId } },
        update: {
          stage: 'SCREENED',
          isShortlisted: true,
          matchScore: data.aiAssessment?.fitScore || 90,
          compositeScore: data.aiAssessment?.fitScore || 90,
          screeningNotes: data.aiAssessment?.screeningNotes || 'Internal resource diversion approved',
        },
        create: {
          candidateId: saved.id,
          jdId: data.jdId,
          stage: 'SCREENED',
          isShortlisted: true,
          matchScore: data.aiAssessment?.fitScore || 90,
          compositeScore: data.aiAssessment?.fitScore || 90,
          screeningNotes: data.aiAssessment?.screeningNotes || 'Internal resource diversion approved',
        },
      })

      await tx.pipelineHistory.create({
        data: {
          pipelineEntryId: pipelineEntry.id,
          toStage: 'SCREENED',
          changedById: session!.user.id,
          notes: existing ? 'Internal resource diversion updated' : 'Internal resource diverted',
        },
      })

      if (data.skills) {
        for (const skill of data.skills.split(',').map(skill => skill.trim()).filter(Boolean)) {
          await tx.candidateSkill.upsert({
            where: { candidateId_skillName: { candidateId: saved.id, skillName: skill } },
            update: { isAiExtracted: false },
            create: { candidateId: saved.id, skillName: skill, isAiExtracted: false },
          })
        }
      }

      return saved
    })

    await auditLog(session!.user.id, existing ? 'UPDATE_INTERNAL_RESOURCE' : 'DIVERT_RESOURCE', 'Candidate', candidate.id, undefined, data, req)
    return ok(candidate, existing ? 200 : 201)
  } catch (e) { return handleError(e) }
}
