import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, handleError, auditLog } from '@/lib/api-utils'
import { screenResume } from '@/lib/ai/screening'
import { z } from 'zod'

const configSchema = z.object({
  jdId: z.string(),
  skillWeight: z.number().min(0).max(100).default(60),
  availabilityWeight: z.number().min(0).max(100).default(20),
  locationWeight: z.number().min(0).max(100).default(20),
  minMatchScore: z.number().min(0).max(100).default(60),
  gapThresholdMonths: z.number().default(6),
  maxNoticeDays: z.number().default(90),
  preferredLocations: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
})

const finalizeSchema = z.object({
  jdId: z.string(),
  selectedEntryIds: z.array(z.string()).default([]),
  rejectOthers: z.boolean().default(false),
})

function defaultConfig() {
  return {
    skillWeight: 60,
    availabilityWeight: 20,
    locationWeight: 20,
    minMatchScore: 60,
    gapThresholdMonths: 6,
    maxNoticeDays: 90,
    preferredLocations: [],
    requiredSkills: [],
  }
}

function buildScreeningNotes(result: Awaited<ReturnType<typeof screenResume>>) {
  return JSON.stringify({
    schemaVersion: '1.0',
    summary: result.summary,
    justification: result.justification,
    recommendation: result.recommendation,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    missingSkills: result.missingSkills,
    criteriaScores: result.criteriaScores,
    screeningCallChecklist: result.screeningCallChecklist,
    analyzedAt: new Date().toISOString(),
  })
}

function renderScreeningValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) return value.map(renderScreeningValue).filter(Boolean).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function appendProfileLine(lines: string[], label: string, value: unknown) {
  const rendered = renderScreeningValue(value)
  if (rendered) lines.push(`${label}: ${rendered}`)
}

function parseScreeningDate(value: unknown): Date | null {
  const text = renderScreeningValue(value)
  if (!text) return null
  if (/^(present|current|now|till date)$/i.test(text)) return new Date()

  const match = text.match(/\b(19|20)\d{2}(?:[-/.\s](0?[1-9]|1[0-2]|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)?\b/i)
  if (!match) return null
  const year = Number(match[0].match(/(19|20)\d{2}/)?.[0])
  const monthText = match[2]
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  }
  const month = monthText
    ? Number.isNaN(Number(monthText)) ? monthNames[monthText.slice(0, 3).toLowerCase()] ?? 0 : Number(monthText) - 1
    : 0
  return Number.isFinite(year) ? new Date(year, month, 1) : null
}

function firstScreeningValue(...values: unknown[]) {
  for (const value of values) {
    if (renderScreeningValue(value)) return value
  }
  return null
}

function inferScreeningExperienceYears(experience: unknown[]) {
  let totalMonths = 0
  for (const item of experience) {
    const role = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
    const start = parseScreeningDate(firstScreeningValue(role.from, role.startDate, role.start, role.periodFrom))
    const end = parseScreeningDate(firstScreeningValue(role.to, role.endDate, role.end, role.periodTo)) || new Date()
    if (start && end >= start) totalMonths += (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1
  }
  return totalMonths ? Math.round((totalMonths / 12) * 10) / 10 : null
}

function resumeTextForCandidate(candidate: any) {
  if (candidate.rawResumeText?.trim()) return candidate.rawResumeText
  const parsedData = candidate.parsedData && typeof candidate.parsedData === 'object' ? candidate.parsedData : {}
  const standardFields = parsedData.standardFields && typeof parsedData.standardFields === 'object' ? parsedData.standardFields : {}
  const extractionMeta = parsedData.extractionMeta && typeof parsedData.extractionMeta === 'object' ? parsedData.extractionMeta : {}
  const parsedStatus = renderScreeningValue(extractionMeta.status)
  const experience = Array.isArray(parsedData.experience) ? parsedData.experience : []
  const latestExperience = experience[0] && typeof experience[0] === 'object' && !Array.isArray(experience[0]) ? experience[0] : {}
  const candidateSkills = Array.isArray(candidate.skills) ? candidate.skills.map((skill: any) => skill.skillName).filter(Boolean) : []
  const parsedSkills = Array.isArray(parsedData.skills)
    ? parsedData.skills.map((skill: any) => typeof skill === 'string' ? skill : skill?.name).filter(Boolean)
    : []

  const lines = ['Candidate profile from ATS data']
  appendProfileLine(lines, 'Full name', candidate.fullName || (standardFields as any).fullName)
  appendProfileLine(lines, 'Email', candidate.email || (standardFields as any).email)
  appendProfileLine(lines, 'Phone', candidate.phone || (standardFields as any).phone)
  appendProfileLine(lines, 'Location', candidate.location || (standardFields as any).location || (latestExperience as any).location)
  appendProfileLine(lines, 'Current title', candidate.currentTitle || (standardFields as any).currentTitle || (latestExperience as any).title || (latestExperience as any).role || (latestExperience as any).designation)
  appendProfileLine(lines, 'Current company', candidate.currentCompany || (standardFields as any).currentCompany || (latestExperience as any).company || (latestExperience as any).employer || (latestExperience as any).organization)
  appendProfileLine(lines, 'Total experience years', candidate.totalExperienceYears || (standardFields as any).totalExperienceYears || inferScreeningExperienceYears(experience))
  appendProfileLine(lines, 'Notice period days', candidate.noticePeriodDays || (standardFields as any).noticePeriodDays)
  appendProfileLine(lines, 'Expected salary', candidate.expectedSalary || (standardFields as any).expectedSalary)
  appendProfileLine(lines, 'LinkedIn', candidate.linkedinUrl || (standardFields as any).linkedinUrl)
  appendProfileLine(lines, 'Skills', [...new Set([...candidateSkills, ...parsedSkills])])

  if (parsedStatus !== 'FAILED') {
    appendProfileLine(lines, 'Summary', parsedData.summary)
    appendProfileLine(lines, 'Experience', experience)
    appendProfileLine(lines, 'Education', parsedData.education)
    appendProfileLine(lines, 'Certifications', parsedData.certifications)
    appendProfileLine(lines, 'Projects', parsedData.projects)
    appendProfileLine(lines, 'Languages', parsedData.languages)
    appendProfileLine(lines, 'Achievements', parsedData.achievements)
    appendProfileLine(lines, 'Availability', parsedData.availabilityNotes)
    appendProfileLine(lines, 'Work authorization', parsedData.workAuthorization)
    appendProfileLine(lines, 'Visa status', parsedData.visaStatus)
  }

  return lines.length > 1 ? lines.join('\n') : ''
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const url = req.nextUrl
    const action = url.searchParams.get('action')

    if (action === 'config') {
      const body = await req.json()
      const data = configSchema.parse(body)

      const config = await prisma.screeningConfig.upsert({
        where: { jdId: data.jdId },
        update: { ...data, createdById: session!.user.id },
        create: { ...data, createdById: session!.user.id },
      })
      return ok(config)
    }

    if (action === 'run') {
      const body = await req.json()
      const { jdId, force, candidateId } = z.object({
        jdId: z.string(),
        force: z.boolean().default(false),
        candidateId: z.string().optional(),
      }).parse(body)

      const jd = await prisma.jobDescription.findUnique({
        where: { id: jdId },
        include: { screeningConfig: true },
      })
      if (!jd) return err('JD not found', 404)

      const config = jd.screeningConfig || defaultConfig()

      const entries = await prisma.pipelineEntry.findMany({
        where: { jdId, ...(candidateId && { candidateId }), ...(force ? {} : { matchScore: null }) },
        include: { candidate: { include: { skills: true } } },
      })

      if (!entries.length) return ok({ screened: 0, total: 0, errors: 0, message: candidateId ? 'Candidate is not linked to this JD' : 'No linked candidates found for this JD' })

      const jdContent = jd.finalContent || jd.polishedContent || jd.rawContent || ''
      let screened = 0
      let errors = 0

      for (const entry of entries) {
        const resumeText = resumeTextForCandidate(entry.candidate)
        if (!resumeText) {
          errors++
          continue
        }
        try {
          const result = await screenResume(
            resumeText,
            jdContent,
            config as any,
            entry.candidate.fullName,
          )

          await prisma.$transaction(async (tx) => {
            await tx.pipelineEntry.update({
              where: { id: entry.id },
              data: {
                matchScore: result.skillScore,
                availabilityScore: result.availabilityScore,
                locationScore: result.locationScore,
                compositeScore: result.compositeScore,
                screeningNotes: buildScreeningNotes(result),
                stage: 'SCREENING',
                isShortlisted: false,
              },
            })

            await tx.pipelineHistory.create({
              data: {
                pipelineEntryId: entry.id,
                fromStage: entry.stage,
                toStage: 'SCREENING',
                changedById: session!.user.id,
                notes: `AI screening: ${result.compositeScore}/100`,
              },
            })

            await tx.candidateRedFlag.deleteMany({
              where: { candidateId: entry.candidateId, jdId },
            })

            for (const flag of result.redFlags) {
              await tx.candidateRedFlag.create({
                data: {
                  candidateId: entry.candidateId,
                  jdId,
                  flagType: flag.type,
                  severity: flag.severity as any,
                  description: flag.description,
                  excerpt: flag.excerpt,
                },
              })
            }

            for (const skill of result.extractedSkills) {
              await tx.candidateSkill.upsert({
                where: { candidateId_skillName: { candidateId: entry.candidateId, skillName: skill } },
                update: {},
                create: { candidateId: entry.candidateId, skillName: skill, isAiExtracted: true },
              })
            }
          })
          screened++
        } catch {
          errors++
        }
      }

      await auditLog(session!.user.id, 'RUN_AI_SCREENING', 'JobDescription', jdId, undefined, { screened, total: entries.length, errors }, req)
      return ok({ screened, total: entries.length, errors })
    }

    if (action === 'finalize') {
      const data = finalizeSchema.parse(await req.json())
      const selectedIds = new Set(data.selectedEntryIds)

      const entries = await prisma.pipelineEntry.findMany({
        where: { jdId: data.jdId },
        select: { id: true, stage: true },
      })

      const selected = entries.filter(entry => selectedIds.has(entry.id))
      const rejected = data.rejectOthers ? entries.filter(entry => !selectedIds.has(entry.id)) : []

      await prisma.$transaction(async (tx) => {
        for (const entry of selected) {
          await tx.pipelineEntry.update({
            where: { id: entry.id },
            data: { stage: 'SCREENED', isShortlisted: true },
          })
          await tx.pipelineHistory.create({
            data: {
              pipelineEntryId: entry.id,
              fromStage: entry.stage,
              toStage: 'SCREENED',
              changedById: session!.user.id,
              notes: 'Recruiter finalized candidate from AI screening',
            },
          })
        }

        for (const entry of rejected) {
          await tx.pipelineEntry.update({
            where: { id: entry.id },
            data: { stage: 'REJECTED', isShortlisted: false, rejectedReason: 'Not selected after AI screening' },
          })
          await tx.pipelineHistory.create({
            data: {
              pipelineEntryId: entry.id,
              fromStage: entry.stage,
              toStage: 'REJECTED',
              changedById: session!.user.id,
              notes: 'Rejected during AI screening finalization',
            },
          })
        }
      })

      await auditLog(session!.user.id, 'FINALIZE_AI_SCREENING', 'JobDescription', data.jdId, undefined, { selected: selected.length, rejected: rejected.length }, req)
      return ok({ selected: selected.length, rejected: rejected.length })
    }

    return err('Invalid action. Use ?action=config, ?action=run, or ?action=finalize', 400)
  } catch (e) { return handleError(e) }
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const jdId = req.nextUrl.searchParams.get('jdId')
    if (!jdId) return err('jdId required', 400)

    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
      include: { screeningConfig: true },
    })
    if (!jd) return err('JD not found', 404)

    const entries = await prisma.pipelineEntry.findMany({
      where: { jdId },
      orderBy: { compositeScore: 'desc' },
      include: {
        jd: { select: { id: true, title: true, client: true } },
        candidate: {
          include: {
            skills: true,
            redFlags: { where: { jdId } },
          },
        },
      },
    })

    return ok({ jd, config: jd.screeningConfig || defaultConfig(), entries })
  } catch (e) { return handleError(e) }
}
