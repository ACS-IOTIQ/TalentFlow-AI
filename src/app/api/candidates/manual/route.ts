import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, auditLog, handleError } from '@/lib/api-utils'

const manualCandidateSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  currentTitle: z.string().optional().nullable(),
  currentCompany: z.string().optional().nullable(),
  totalExperienceYears: z.number().optional().nullable(),
  noticePeriodDays: z.number().optional().nullable(),
  expectedSalary: z.number().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  jdId: z.string().optional().nullable(),
  skills: z.array(z.string()).default([]),
  summary: z.string().optional().nullable(),
  education: z.array(z.string()).default([]),
  experience: z.array(z.string()).default([]),
  hrVerified: z.boolean().default(true),
})

function cleanText(value?: string | null) {
  return value?.trim() || null
}

function profileCompleteness(data: z.infer<typeof manualCandidateSchema>) {
  const fields = [
    data.fullName,
    data.email,
    data.phone,
    data.location,
    data.currentTitle,
    data.currentCompany,
    data.totalExperienceYears,
    data.skills.length,
  ]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const data = manualCandidateSchema.parse(await req.json())
    const email = cleanText(data.email)
    const phone = cleanText(data.phone)

    const duplicate = await prisma.candidate.findFirst({
      where: {
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: { id: true, fullName: true, email: true, phone: true },
    })
    if (duplicate) return err(`Possible duplicate candidate: ${duplicate.fullName}`, 409)

    if (data.jdId) {
      const jd = await prisma.jobDescription.findUnique({ where: { id: data.jdId }, select: { id: true } })
      if (!jd) return err('JD not found', 404)
    }

    const candidate = await prisma.$transaction(async (tx) => {
      const saved = await tx.candidate.create({
        data: {
          fullName: data.fullName.trim(),
          email,
          phone,
          location: cleanText(data.location),
          currentTitle: cleanText(data.currentTitle),
          currentCompany: cleanText(data.currentCompany),
          totalExperienceYears: data.totalExperienceYears,
          noticePeriodDays: data.noticePeriodDays,
          expectedSalary: data.expectedSalary,
          linkedinUrl: cleanText(data.linkedinUrl),
          source: cleanText(data.source) || 'Manual',
          parsedData: {
            schemaVersion: 'manual-1.0',
            summary: cleanText(data.summary),
            education: data.education,
            experience: data.experience,
            skills: data.skills.map(name => ({ name })),
            hrVerified: data.hrVerified,
            profileCompleteness: profileCompleteness(data),
            extractionMeta: {
              schemaVersion: '1.0',
              provider: 'manual-entry',
              model: 'hr-form',
              status: 'PARSED',
              confidence: data.hrVerified ? 100 : profileCompleteness(data),
              missingFields: [],
              extractedAt: new Date().toISOString(),
            },
          },
        },
      })

      for (const skillName of data.skills.map(skill => skill.trim()).filter(Boolean)) {
        await tx.candidateSkill.create({
          data: {
            candidateId: saved.id,
            skillName,
            isAiExtracted: false,
          },
        })
      }

      if (data.jdId) {
        const entry = await tx.pipelineEntry.create({
          data: {
            candidateId: saved.id,
            jdId: data.jdId,
            stage: 'PROFILE_COMPLETE',
            isShortlisted: false,
          },
        })
        await tx.pipelineHistory.create({
          data: {
            pipelineEntryId: entry.id,
            toStage: 'PROFILE_COMPLETE',
            changedById: session!.user.id,
            notes: 'Manual candidate created and linked to JD',
          },
        })
      }

      return saved
    })

    await auditLog(session!.user.id, 'CREATE_MANUAL_CANDIDATE', 'Candidate', candidate.id, undefined, data, req)
    return ok(candidate, 201)
  } catch (e) { return handleError(e) }
}
