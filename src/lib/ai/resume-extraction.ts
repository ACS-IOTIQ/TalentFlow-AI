import { generateAIText } from '@/lib/ai/provider'

export interface ResumeExtractionSkill {
  name: string
  category?: string | null
  proficiency?: string | null
  yearsUsed?: number | null
}

export interface ResumeExtractionConcern {
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  description: string
  excerpt?: string | null
}

export interface ResumeProfileExtraction {
  standardFields: {
    fullName?: string | null
    email?: string | null
    phone?: string | null
    location?: string | null
    currentTitle?: string | null
    currentCompany?: string | null
    totalExperienceYears?: number | null
    noticePeriodDays?: number | null
    expectedSalary?: number | null
    linkedinUrl?: string | null
  }
  skills: ResumeExtractionSkill[]
  dynamicDetails: {
    summary?: string | null
    experience?: unknown[]
    education?: unknown[]
    certifications?: unknown[]
    projects?: unknown[]
    languages?: unknown[]
    achievements?: unknown[]
    links?: unknown[]
    workAuthorization?: string | null
    visaStatus?: string | null
    salaryNotes?: string | null
    availabilityNotes?: string | null
    gaps?: unknown[]
    concerns?: ResumeExtractionConcern[]
    rawInferredFields?: Record<string, unknown>
  }
  extractionMeta: {
    schemaVersion: '1.0'
    model: string
    provider: string
    extractedAt: string
    confidence: number
    missingFields: string[]
    status: 'PARSED'
    sourceFileName?: string
  }
}

export interface ResumeExtractionJDContext {
  title: string
  client?: string | null
  location?: string | null
  content?: string | null
  requiredSkills?: unknown
}

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeText(value)
    if (normalized) return normalized
  }
  return null
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function parseResumeDate(value: unknown): Date | null {
  const text = normalizeText(value)
  if (!text) return null
  if (/^(present|current|now|till date)$/i.test(text)) return new Date()

  const yearMonth = text.match(/\b(19|20)\d{2}(?:[-/.\s](0?[1-9]|1[0-2]|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)?\b/i)
  if (!yearMonth) return null

  const year = Number(yearMonth[0].match(/(19|20)\d{2}/)?.[0])
  const monthText = yearMonth[2]
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  }
  const month = monthText
    ? Number.isNaN(Number(monthText)) ? monthNames[monthText.slice(0, 3).toLowerCase()] ?? 0 : Number(monthText) - 1
    : 0

  return Number.isFinite(year) ? new Date(year, month, 1) : null
}

function monthsBetween(start: Date, end: Date) {
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
  return Math.max(0, months + 1)
}

function inferExperienceYears(experience: unknown[]) {
  let totalMonths = 0
  for (const item of experience) {
    const role = objectValue(item)
    const start = parseResumeDate(firstText(role.from, role.startDate, role.start, role.periodFrom))
    const end = parseResumeDate(firstText(role.to, role.endDate, role.end, role.periodTo)) || new Date()
    if (start && end >= start) totalMonths += monthsBetween(start, end)
  }

  return totalMonths ? Math.round((totalMonths / 12) * 10) / 10 : null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripJsonFences(text: string) {
  return text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = stripJsonFences(text)
  try {
    const parsed = JSON.parse(cleaned)
    if (isObject(parsed)) return parsed
  } catch {
  }

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1))
      if (isObject(parsed)) return parsed
    } catch {
      throw new Error('AI resume extraction returned invalid JSON')
    }
  }

  throw new Error('AI resume extraction returned invalid JSON')
}

async function repairResumeExtractionJson(
  invalidResponse: string,
  resumeText: string,
  jdBlock: string,
  sourceFileName: string | undefined,
) {
  const result = await generateAIText({
    maxTokens: 2500,
    json: true,
    system: 'Convert resume extraction output into valid JSON only. Never include markdown or commentary.',
    prompt: `Return one valid JSON object matching this schema. Use the resume text when available to fill missing values, and use null/empty arrays when unknown. Infer currentTitle/currentCompany from the most recent role. Compute totalExperienceYears from dated work history when explicit total experience is missing.
${jdBlock}
File: ${sourceFileName || 'unknown'}
Invalid previous output:
${compactText(invalidResponse, 5000)}
Resume text:
${compactText(resumeText, 10000) || 'Not available; use only facts present in the previous output.'}
JSON schema:
{"standardFields":{"fullName":null,"email":null,"phone":null,"location":null,"currentTitle":null,"currentCompany":null,"totalExperienceYears":null,"noticePeriodDays":null,"expectedSalary":null,"linkedinUrl":null},"skills":[{"name":"","category":null,"proficiency":null,"yearsUsed":null}],"dynamicDetails":{"summary":null,"experience":[{"title":"","company":"","from":null,"to":null,"location":null,"highlights":[]}],"education":[{"degree":null,"institution":null,"year":null,"details":null}],"certifications":[{"name":"","issuer":null,"year":null}],"projects":[{"name":"","role":null,"description":null,"technologies":[]}],"languages":[{"name":"","proficiency":null}],"achievements":[],"links":[{"label":"","url":""}],"workAuthorization":null,"visaStatus":null,"salaryNotes":null,"availabilityNotes":null,"gaps":[{"period":"","description":""}],"concerns":[{"type":"employment_gap|vague_education|job_hopping|missing_contact|other","severity":"INFO|WARNING|CRITICAL","description":"","excerpt":null}],"rawInferredFields":{}},"extractionMeta":{"confidence":0,"missingFields":[]}}`,
  })

  return result
}

function normalizeSkills(value: unknown): ResumeExtractionSkill[] {
  return arrayValue(value).flatMap((skill) => {
    if (typeof skill === 'string') {
      const name = skill.trim()
      return name ? [{ name }] : []
    }

    const item = objectValue(skill)
    const name = normalizeText(item.name)
    if (!name) return []

    return [{
      name,
      category: normalizeText(item.category),
      proficiency: normalizeText(item.proficiency),
      yearsUsed: normalizeNumber(item.yearsUsed),
    }]
  })
}

function normalizeConcerns(value: unknown): ResumeExtractionConcern[] {
  return arrayValue(value).flatMap((concern) => {
    const item = objectValue(concern)
    const type = normalizeText(item.type)
    const description = normalizeText(item.description)
    if (!type || !description) return []

    const severity = normalizeText(item.severity)
    return [{
      type,
      severity: severity === 'INFO' || severity === 'CRITICAL' ? severity : 'WARNING',
      description,
      excerpt: normalizeText(item.excerpt),
    }]
  })
}

function hasNormalizedText(value: unknown) {
  return Boolean(normalizeText(value))
}

function estimateConfidence(
  standardFields: Record<string, unknown>,
  dynamicDetails: Record<string, unknown>,
  skills: ResumeExtractionSkill[],
) {
  const standardFieldNames = ['fullName', 'email', 'phone', 'location', 'currentTitle', 'currentCompany', 'totalExperienceYears']
  const populatedStandardFields = standardFieldNames.filter(field => {
    const value = standardFields[field]
    return typeof value === 'number' ? Number.isFinite(value) : hasNormalizedText(value)
  }).length
  const detailSections = ['summary', 'experience', 'education', 'projects', 'certifications']
  const populatedDetails = detailSections.filter(field => {
    const value = dynamicDetails[field]
    return Array.isArray(value) ? value.length > 0 : hasNormalizedText(value)
  }).length

  const standardScore = populatedStandardFields / standardFieldNames.length
  const detailScore = populatedDetails / detailSections.length
  const skillScore = Math.min(skills.length, 8) / 8
  return Math.max(0.35, Math.min(0.95, standardScore * 0.55 + skillScore * 0.25 + detailScore * 0.2))
}

function normalizeExtraction(
  raw: Record<string, unknown>,
  sourceFileName: string | undefined,
  model: string,
  provider: string,
): ResumeProfileExtraction {
  const standardFields = objectValue(raw.standardFields)
  const dynamicDetails = objectValue(raw.dynamicDetails)
  const extractionMeta = objectValue(raw.extractionMeta)
  const skills = normalizeSkills(raw.skills)
  const experience = arrayValue(dynamicDetails.experience)
  const latestExperience = objectValue(experience[0])
  const inferredCurrentTitle = firstText(
    standardFields.currentTitle,
    latestExperience.title,
    latestExperience.role,
    latestExperience.designation,
    latestExperience.position,
  )
  const inferredCurrentCompany = firstText(
    standardFields.currentCompany,
    latestExperience.company,
    latestExperience.employer,
    latestExperience.organization,
    latestExperience.client,
  )
  const inferredExperienceYears = normalizeNumber(standardFields.totalExperienceYears) ?? inferExperienceYears(experience)
  const rawConfidence = normalizeNumber(extractionMeta.confidence)
  const usefulExtraction = Object.values(standardFields).some(value => hasNormalizedText(value) || typeof value === 'number') ||
    skills.length > 0 ||
    Object.values(dynamicDetails).some(value => Array.isArray(value) ? value.length > 0 : hasNormalizedText(value))
  const confidence = rawConfidence && rawConfidence > 0
    ? rawConfidence
    : usefulExtraction ? estimateConfidence(standardFields, dynamicDetails, skills) : 0
  const missingFields = arrayValue(extractionMeta.missingFields)
    .map(field => normalizeText(field))
    .filter((field): field is string => Boolean(field))

  return {
    standardFields: {
      fullName: normalizeText(standardFields.fullName),
      email: normalizeText(standardFields.email),
      phone: normalizeText(standardFields.phone),
      location: normalizeText(standardFields.location),
      currentTitle: inferredCurrentTitle,
      currentCompany: inferredCurrentCompany,
      totalExperienceYears: inferredExperienceYears,
      noticePeriodDays: normalizeNumber(standardFields.noticePeriodDays),
      expectedSalary: normalizeNumber(standardFields.expectedSalary),
      linkedinUrl: normalizeText(standardFields.linkedinUrl),
    },
    skills,
    dynamicDetails: {
      summary: normalizeText(dynamicDetails.summary),
      experience,
      education: arrayValue(dynamicDetails.education),
      certifications: arrayValue(dynamicDetails.certifications),
      projects: arrayValue(dynamicDetails.projects),
      languages: arrayValue(dynamicDetails.languages),
      achievements: arrayValue(dynamicDetails.achievements),
      links: arrayValue(dynamicDetails.links),
      workAuthorization: normalizeText(dynamicDetails.workAuthorization),
      visaStatus: normalizeText(dynamicDetails.visaStatus),
      salaryNotes: normalizeText(dynamicDetails.salaryNotes),
      availabilityNotes: normalizeText(dynamicDetails.availabilityNotes),
      gaps: arrayValue(dynamicDetails.gaps),
      concerns: normalizeConcerns(dynamicDetails.concerns),
      rawInferredFields: objectValue(dynamicDetails.rawInferredFields),
    },
    extractionMeta: {
      schemaVersion: '1.0',
      model,
      provider,
      extractedAt: new Date().toISOString(),
      confidence: Math.max(0, Math.min(1, confidence)),
      missingFields,
      status: 'PARSED',
      sourceFileName,
    },
  }
}

function compactText(value: string | null | undefined, maxChars: number) {
  if (!value) return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars)}...` : normalized
}

export async function extractResumeProfile(
  resumeText: string,
  jdContext?: ResumeExtractionJDContext | null,
  sourceFileName?: string,
): Promise<ResumeProfileExtraction> {
  if (!resumeText.trim()) throw new Error('Resume text is empty')

  const jdBlock = jdContext
    ? `JD: ${jdContext.title}; client=${jdContext.client || 'N/A'}; location=${jdContext.location || 'N/A'}; skills=${JSON.stringify(jdContext.requiredSkills || [])}; content=${compactText(jdContext.content, 1800)}`
    : 'JD: none'

  const result = await generateAIText({
    maxTokens: 2500,
    json: true,
    system: 'Expert resume parser. Output only valid JSON matching the requested schema. Use null for unknowns; never invent facts.',
    prompt: `Task: extract a complete hiring profile from the resume.
Rules: dates YYYY-MM when possible; order experience newest first; infer currentTitle/currentCompany from the newest role; compute totalExperienceYears from dated work history if explicit total experience is absent; expectedSalary numeric only if explicit; noticePeriodDays numeric days; confidence 0..1; put unusual useful fields in rawInferredFields; list uncertain absent standard fields in missingFields.
${jdBlock}
File: ${sourceFileName || 'unknown'}
Resume: ${compactText(resumeText, 12000)}
JSON schema:
{"standardFields":{"fullName":null,"email":null,"phone":null,"location":null,"currentTitle":null,"currentCompany":null,"totalExperienceYears":null,"noticePeriodDays":null,"expectedSalary":null,"linkedinUrl":null},"skills":[{"name":"","category":null,"proficiency":null,"yearsUsed":null}],"dynamicDetails":{"summary":null,"experience":[{"title":"","company":"","from":null,"to":null,"location":null,"highlights":[]}],"education":[{"degree":null,"institution":null,"year":null,"details":null}],"certifications":[{"name":"","issuer":null,"year":null}],"projects":[{"name":"","role":null,"description":null,"technologies":[]}],"languages":[{"name":"","proficiency":null}],"achievements":[],"links":[{"label":"","url":""}],"workAuthorization":null,"visaStatus":null,"salaryNotes":null,"availabilityNotes":null,"gaps":[{"period":"","description":""}],"concerns":[{"type":"employment_gap|vague_education|job_hopping|missing_contact|other","severity":"INFO|WARNING|CRITICAL","description":"","excerpt":null}],"rawInferredFields":{}},"extractionMeta":{"confidence":0,"missingFields":[]}}`,
  })

  try {
    return normalizeExtraction(parseJsonObject(result.text), sourceFileName, result.model, result.provider)
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('invalid JSON')) throw error

    const repaired = await repairResumeExtractionJson(result.text, resumeText, jdBlock, sourceFileName)
    return normalizeExtraction(parseJsonObject(repaired.text), sourceFileName, repaired.model, repaired.provider)
  }
}

export async function extractResumeProfileFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
  jdContext?: ResumeExtractionJDContext | null,
  sourceFileName?: string,
): Promise<ResumeProfileExtraction> {
  if (!fileBuffer.length) throw new Error('Resume file is empty')

  const jdBlock = jdContext
    ? `JD: ${jdContext.title}; client=${jdContext.client || 'N/A'}; location=${jdContext.location || 'N/A'}; skills=${JSON.stringify(jdContext.requiredSkills || [])}; content=${compactText(jdContext.content, 1800)}`
    : 'JD: none'

  const result = await generateAIText({
    maxTokens: 2500,
    json: true,
    system: 'Expert resume parser. Output only valid JSON matching the requested schema. Use null for unknowns; never invent facts.',
    prompt: `Task: extract a complete hiring profile from the attached resume document.
Rules: dates YYYY-MM when possible; order experience newest first; infer currentTitle/currentCompany from the newest role; compute totalExperienceYears from dated work history if explicit total experience is absent; expectedSalary numeric only if explicit; noticePeriodDays numeric days; confidence 0..1; put unusual useful fields in rawInferredFields; list uncertain absent standard fields in missingFields.
${jdBlock}
File: ${sourceFileName || 'unknown'}
JSON schema:
{"standardFields":{"fullName":null,"email":null,"phone":null,"location":null,"currentTitle":null,"currentCompany":null,"totalExperienceYears":null,"noticePeriodDays":null,"expectedSalary":null,"linkedinUrl":null},"skills":[{"name":"","category":null,"proficiency":null,"yearsUsed":null}],"dynamicDetails":{"summary":null,"experience":[{"title":"","company":"","from":null,"to":null,"location":null,"highlights":[]}],"education":[{"degree":null,"institution":null,"year":null,"details":null}],"certifications":[{"name":"","issuer":null,"year":null}],"projects":[{"name":"","role":null,"description":null,"technologies":[]}],"languages":[{"name":"","proficiency":null}],"achievements":[],"links":[{"label":"","url":""}],"workAuthorization":null,"visaStatus":null,"salaryNotes":null,"availabilityNotes":null,"gaps":[{"period":"","description":""}],"concerns":[{"type":"employment_gap|vague_education|job_hopping|missing_contact|other","severity":"INFO|WARNING|CRITICAL","description":"","excerpt":null}],"rawInferredFields":{}},"extractionMeta":{"confidence":0,"missingFields":[]}}`,
    inlineData: {
      mimeType,
      data: fileBuffer.toString('base64'),
    },
  })

  try {
    return normalizeExtraction(parseJsonObject(result.text), sourceFileName, result.model, result.provider)
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('invalid JSON')) throw error

    const repaired = await repairResumeExtractionJson(result.text, '', jdBlock, sourceFileName)
    return normalizeExtraction(parseJsonObject(repaired.text), sourceFileName, repaired.model, repaired.provider)
  }
}
