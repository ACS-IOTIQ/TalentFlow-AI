import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'
import { analyzeCandidateProfile } from '@/lib/ai/candidate-analysis'

function renderValue(value: any): string {
  if (value === null || value === undefined || value === '') return ''
  if (Array.isArray(value)) return value.map(renderValue).filter(Boolean).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function linesFromObject(title: string, value: any) {
  if (!value) return []
  if (Array.isArray(value) && !value.length) return []
  return [`${title}: ${renderValue(value)}`]
}

function candidateProfile(candidate: any) {
  const parsedData = candidate.parsedData && typeof candidate.parsedData === 'object' ? candidate.parsedData : {}
  const standardFields = parsedData.standardFields || {}
  const skills = candidate.skills?.map((skill: any) => skill.skillName).filter(Boolean) || []

  return [
    `Full name: ${candidate.fullName}`,
    candidate.email && `Email: ${candidate.email}`,
    candidate.phone && `Phone: ${candidate.phone}`,
    `Location: ${renderValue(candidate.location || standardFields.location) || 'Not provided'}`,
    `Current title: ${renderValue(candidate.currentTitle || standardFields.currentTitle) || 'Not provided'}`,
    `Current company: ${renderValue(candidate.currentCompany || standardFields.currentCompany) || 'Not provided'}`,
    `Experience years: ${renderValue(candidate.totalExperienceYears || standardFields.totalExperienceYears) || 'Not provided'}`,
    `Notice period days: ${renderValue(candidate.noticePeriodDays || standardFields.noticePeriodDays) || 'Not provided'}`,
    `Expected salary: ${renderValue(candidate.expectedSalary || standardFields.expectedSalary) || 'Not provided'}`,
    `LinkedIn: ${renderValue(candidate.linkedinUrl || standardFields.linkedinUrl) || 'Not provided'}`,
    ...linesFromObject('Summary', parsedData.summary),
    ...linesFromObject('Skills', skills.length ? skills : parsedData.skills),
    ...linesFromObject('Experience', parsedData.experience),
    ...linesFromObject('Education', parsedData.education),
    ...linesFromObject('Certifications', parsedData.certifications),
    ...linesFromObject('Projects', parsedData.projects),
    ...linesFromObject('Availability notes', parsedData.availabilityNotes),
    ...linesFromObject('Salary notes', parsedData.salaryNotes),
    ...linesFromObject('Resume text', candidate.rawResumeText),
  ].filter(Boolean).join('\n')
}

function jdProfile(jd: any) {
  if (!jd) return undefined
  return [
    `JD title: ${jd.title}`,
    `Client: ${jd.client}`,
    jd.location && `Location: ${jd.location}`,
    jd.experienceMin != null && `Minimum experience: ${jd.experienceMin}`,
    jd.experienceMax != null && `Maximum experience: ${jd.experienceMax}`,
    jd.requiredSkills && `Required skills: ${renderValue(jd.requiredSkills)}`,
    jd.finalContent || jd.polishedContent || jd.rawContent,
  ].filter(Boolean).join('\n')
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR', 'DIR_TECH'])
    if (error) return error

    const candidate = await prisma.candidate.findUnique({
      where: { id: params.id },
      include: {
        skills: true,
        pipelineEntries: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          include: {
            jd: {
              select: {
                id: true,
                title: true,
                client: true,
                location: true,
                experienceMin: true,
                experienceMax: true,
                requiredSkills: true,
                rawContent: true,
                polishedContent: true,
                finalContent: true,
              },
            },
          },
        },
      },
    })
    if (!candidate) return err('Candidate not found', 404)

    const profile = candidateProfile(candidate)
    if (profile.replace(/\s+/g, '').length < 40) {
      return err('Candidate profile is too empty to analyze', 400)
    }

    const entry = candidate.pipelineEntries[0]
    const analysis = await analyzeCandidateProfile({
      candidateProfile: profile,
      jdContext: jdProfile(entry?.jd),
    })
    const parsedData = candidate.parsedData && typeof candidate.parsedData === 'object' && !Array.isArray(candidate.parsedData)
      ? candidate.parsedData as Record<string, any>
      : {}
    const storedAnalysis = {
      schemaVersion: 'candidate-analysis-1.0',
      ...analysis,
      jdId: entry?.jdId || null,
    }

    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          parsedData: {
            ...parsedData,
            aiCandidateAnalysis: storedAnalysis,
          } as any,
        },
      })

      if (entry) {
        await tx.pipelineEntry.update({
          where: { id: entry.id },
          data: {
            matchScore: analysis.skillScore,
            availabilityScore: analysis.availabilityScore,
            locationScore: analysis.locationScore,
            compositeScore: analysis.overallScore,
            screeningNotes: JSON.stringify(storedAnalysis),
          } as any,
        })
      }

      await tx.candidateRedFlag.deleteMany({
        where: {
          candidateId: candidate.id,
          jdId: entry?.jdId || null,
        },
      })

      if (analysis.flags.length) {
        await tx.candidateRedFlag.createMany({
          data: analysis.flags.map(flag => ({
            candidateId: candidate.id,
            jdId: entry?.jdId || null,
            flagType: flag.type,
            severity: flag.severity,
            description: flag.description,
            excerpt: flag.excerpt,
          })),
        })
      }
    })

    await auditLog(session!.user.id, 'ANALYZE_CANDIDATE', 'Candidate', candidate.id, undefined, storedAnalysis, req)
    return ok(storedAnalysis)
  } catch (e) { return handleError(e) }
}
