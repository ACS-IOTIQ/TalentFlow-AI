import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, ok, err, paginatedOk, getPagination, auditLog, handleError } from '@/lib/api-utils'
import { uploadFile, BUCKETS } from '@/lib/storage'
import { extractTextFromFile, extractFilesFromZip, inferNameFromFilename, parseResumeHeuristically } from '@/lib/resume-parser'
import { extractResumeProfile, extractResumeProfileFromDocument, type ResumeProfileExtraction, type ResumeExtractionJDContext } from '@/lib/ai/resume-extraction'
import { aiFeaturesEnabled } from '@/lib/feature-flags'
import { v4 as uuid } from 'uuid'

type UploadResults = {
  created: number
  updated: number
  skipped: number
  errors: number
  aiParsed: number
  manualParsed: number
  fallbackCreated: number
  extractionErrors: Array<{ fileName: string; error: string }>
}

function textOrUndefined(value?: string | null) {
  return value?.trim() || undefined
}

function numberOrUndefined(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parsedDataFromExtraction(extraction: ResumeProfileExtraction) {
  return {
    schemaVersion: extraction.extractionMeta.schemaVersion,
    standardFields: extraction.standardFields,
    skills: extraction.skills,
    ...extraction.dynamicDetails,
    extractionMeta: extraction.extractionMeta,
  }
}

function fallbackParsedData(filename: string, errorMessage: string) {
  return {
    schemaVersion: '1.0',
    extractionMeta: {
      schemaVersion: '1.0',
      model: null,
      extractedAt: new Date().toISOString(),
      confidence: 0,
      missingFields: [
        'email',
        'phone',
        'location',
        'currentTitle',
        'currentCompany',
        'totalExperienceYears',
      ],
      status: 'FAILED',
      sourceFileName: filename,
      error: errorMessage,
    },
  }
}

function candidateCreateData(
  extraction: ResumeProfileExtraction | null,
  filename: string,
  resumeText: string,
  errorMessage?: string,
) {
  const fields = extraction?.standardFields
  return {
    fullName: textOrUndefined(fields?.fullName) || inferNameFromFilename(filename),
    email: textOrUndefined(fields?.email),
    phone: textOrUndefined(fields?.phone),
    location: textOrUndefined(fields?.location),
    currentTitle: textOrUndefined(fields?.currentTitle),
    currentCompany: textOrUndefined(fields?.currentCompany),
    totalExperienceYears: numberOrUndefined(fields?.totalExperienceYears),
    noticePeriodDays: numberOrUndefined(fields?.noticePeriodDays),
    expectedSalary: numberOrUndefined(fields?.expectedSalary),
    linkedinUrl: textOrUndefined(fields?.linkedinUrl),
    source: 'Upload',
    rawResumeText: resumeText,
    parsedData: extraction ? parsedDataFromExtraction(extraction) : fallbackParsedData(filename, errorMessage || 'AI extraction failed'),
  }
}

function candidateUpdateData(
  extraction: ResumeProfileExtraction | null,
  filename: string,
  resumeText: string,
  existingSource?: string | null,
  existingFullName?: string | null,
  errorMessage?: string,
) {
  const createData = candidateCreateData(extraction, filename, resumeText, errorMessage)
  return {
    fullName: textOrUndefined(extraction?.standardFields.fullName) || existingFullName || createData.fullName,
    ...(createData.email && { email: createData.email }),
    ...(createData.phone && { phone: createData.phone }),
    ...(createData.location && { location: createData.location }),
    ...(createData.currentTitle && { currentTitle: createData.currentTitle }),
    ...(createData.currentCompany && { currentCompany: createData.currentCompany }),
    ...(createData.totalExperienceYears !== undefined && { totalExperienceYears: createData.totalExperienceYears }),
    ...(createData.noticePeriodDays !== undefined && { noticePeriodDays: createData.noticePeriodDays }),
    ...(createData.expectedSalary !== undefined && { expectedSalary: createData.expectedSalary }),
    ...(createData.linkedinUrl && { linkedinUrl: createData.linkedinUrl }),
    source: existingSource || 'Upload',
    rawResumeText: resumeText,
    parsedData: createData.parsedData,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth()
    if (error) return error

    const { page, pageSize, skip } = getPagination(req.nextUrl)
    const search = req.nextUrl.searchParams.get('search') || ''
    const jdId = req.nextUrl.searchParams.get('jdId')
    const stage = req.nextUrl.searchParams.get('stage')
    const isInternal = req.nextUrl.searchParams.get('internal')

    const pipelineWhere = {
      ...(jdId && { jdId }),
      ...(stage && { stage: stage as any }),
    }

    const where = {
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { currentTitle: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(isInternal !== null && { isInternal: isInternal === 'true' }),
      ...(Object.keys(pipelineWhere).length > 0 && {
        pipelineEntries: { some: pipelineWhere },
      }),
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          pipelineEntries: {
            ...(jdId && { where: { jdId } }),
            include: { jd: { select: { title: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          skills: { take: 10 },
          redFlags: { take: 5 },
          _count: { select: { documents: true, redFlags: true } },
        },
      }),
      prisma.candidate.count({ where }),
    ])

    return paginatedOk(candidates, total, page, pageSize)
  } catch (e) { return handleError(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await requireAuth(['SUPER_ADMIN', 'CSO', 'HR', 'DIR_TECH'])
    if (error) return error

    const formData = await req.formData()
    const jdId = formData.get('jdId') as string | null
    const files = formData.getAll('files') as File[]

    if (!files.length) return err('No files provided', 400)

    const jd = jdId
      ? await prisma.jobDescription.findUnique({
        where: { id: jdId },
        select: {
          id: true,
          title: true,
          client: true,
          location: true,
          rawContent: true,
          polishedContent: true,
          finalContent: true,
          requiredSkills: true,
        },
      })
      : null

    if (jdId && !jd) return err('JD not found', 404)

    const jdContext: ResumeExtractionJDContext | null = jd
      ? {
        title: jd.title,
        client: jd.client,
        location: jd.location,
        content: jd.finalContent || jd.polishedContent || jd.rawContent,
        requiredSkills: jd.requiredSkills,
      }
      : null

    const results: UploadResults = { created: 0, updated: 0, skipped: 0, errors: 0, aiParsed: 0, manualParsed: 0, fallbackCreated: 0, extractionErrors: [] }

    async function processFile(file: File, buffer: Buffer) {
      const isZip = file.name.toLowerCase().endsWith('.zip')
      const filesToProcess = isZip
        ? await extractFilesFromZip(buffer)
        : [{ filename: file.name, buffer, mimeType: file.type }]

      if (!filesToProcess.length) {
        results.skipped++
        return
      }

      for (const f of filesToProcess) {
        try {
          const text = await extractTextFromFile(f.buffer, f.filename)
          let extraction: ResumeProfileExtraction | null = null
          let extractionError: string | undefined

          if (aiFeaturesEnabled()) {
            try {
              extraction = text.trim()
                ? await extractResumeProfile(text, jdContext, f.filename)
                : await extractResumeProfileFromDocument(f.buffer, f.mimeType || 'application/pdf', jdContext, f.filename)
              results.aiParsed++
            } catch (e) {
              const rawMessage = e instanceof Error ? e.message : 'AI extraction failed'
              extractionError = rawMessage.startsWith('OLLAMA_NO_MULTIMODAL')
                ? 'AI could not read this file directly (scanned/image-based document); using manual parser'
                : rawMessage
              results.extractionErrors.push({ fileName: f.filename, error: extractionError })
            }
          }

          if (!extraction && text.trim()) {
            extraction = parseResumeHeuristically(text, f.filename) as ResumeProfileExtraction
            results.manualParsed++
          }

          if (!extraction) {
            extractionError ||= aiFeaturesEnabled() ? 'AI extraction failed and no readable text was found' : 'No readable text was found for manual parsing'
            results.fallbackCreated++
          }

          const email = textOrUndefined(extraction?.standardFields.email)
          const key = `resumes/${uuid()}-${f.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          await uploadFile(BUCKETS.RESUMES, key, f.buffer, f.mimeType || 'application/octet-stream')

          const existingCandidate = email
            ? await prisma.candidate.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
            : null

          await prisma.$transaction(async (tx) => {
            const candidate = existingCandidate
              ? await tx.candidate.update({
                where: { id: existingCandidate.id },
                data: candidateUpdateData(extraction, f.filename, text, existingCandidate.source, existingCandidate.fullName, extractionError) as any,
              })
              : await tx.candidate.create({
                data: candidateCreateData(extraction, f.filename, text, extractionError) as any,
              })

            await tx.candidateDocument.create({
              data: {
                candidateId: candidate.id,
                fileName: f.filename,
                fileKey: key,
                fileType: f.mimeType || 'application/octet-stream',
                fileSizeBytes: f.buffer.length,
                uploadedById: session!.user.id,
              },
            })

            if (extraction) {
              const seenSkills = new Set<string>()
              for (const skill of extraction.skills) {
                const skillName = skill.name.trim()
                const skillKey = skillName.toLowerCase()
                if (!skillName || seenSkills.has(skillKey)) continue
                seenSkills.add(skillKey)

                await tx.candidateSkill.upsert({
                  where: { candidateId_skillName: { candidateId: candidate.id, skillName } },
                  update: {
                    proficiency: skill.proficiency || undefined,
                    yearsUsed: numberOrUndefined(skill.yearsUsed),
                    isAiExtracted: true,
                  },
                  create: {
                    candidateId: candidate.id,
                    skillName,
                    proficiency: skill.proficiency || undefined,
                    yearsUsed: numberOrUndefined(skill.yearsUsed),
                    isAiExtracted: true,
                  },
                })
              }

              for (const concern of extraction.dynamicDetails.concerns || []) {
                await tx.candidateRedFlag.create({
                  data: {
                    candidateId: candidate.id,
                    jdId: jd?.id,
                    flagType: concern.type,
                    severity: concern.severity as any,
                    description: concern.description,
                    excerpt: concern.excerpt || undefined,
                  },
                })
              }
            }

            if (jd?.id) {
              const pipelineEntry = await tx.pipelineEntry.upsert({
                where: { candidateId_jdId: { candidateId: candidate.id, jdId: jd.id } },
                update: {},
                create: { candidateId: candidate.id, jdId: jd.id, stage: extraction ? 'PROFILE_COMPLETE' : 'NEW' },
              })

              await tx.pipelineHistory.create({
                data: {
                  pipelineEntryId: pipelineEntry.id,
                  toStage: 'NEW',
                  changedById: session!.user.id,
                  notes: existingCandidate ? 'Resume re-uploaded and linked to JD' : 'Resume uploaded and linked to JD',
                },
              })
            }

            if (existingCandidate) results.updated++
            else results.created++
          })
        } catch {
          results.errors++
        }
      }
    }

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      await processFile(file, buffer)
    }

    await auditLog(session!.user.id, 'UPLOAD_RESUMES', 'Candidate', undefined, undefined, results, req)
    return ok(results, 201)
  } catch (e) { return handleError(e) }
}
