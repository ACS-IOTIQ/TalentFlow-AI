import { generateAIText } from '@/lib/ai/provider'

export interface ExtractedJobDescription {
  title: string
  client: string
  location?: string | null
  employmentType?: string | null
  experienceMin?: number | null
  experienceMax?: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  openings: number
  requiredSkills: string[]
  rawContent: string
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
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
  }

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
    }
  }

  throw new Error('AI JD extraction returned invalid JSON')
}

function compact(value: string, maxChars: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return null
}

function skills(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item).trim()).filter(Boolean).slice(0, 30)
}

function titleFromText(value: string) {
  const line = value
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(item => item.length >= 3 && item.length <= 120)
  return line || 'Untitled job description'
}

function normalizeExtraction(parsed: Record<string, unknown>, fallbackRawContent: string): ExtractedJobDescription {
  const rawContent = text(parsed.rawContent) || fallbackRawContent.trim()
  return {
    title: text(parsed.title) || titleFromText(rawContent),
    client: text(parsed.client) || 'Tahaluf',
    location: text(parsed.location),
    employmentType: text(parsed.employmentType),
    experienceMin: number(parsed.experienceMin),
    experienceMax: number(parsed.experienceMax),
    salaryMin: number(parsed.salaryMin),
    salaryMax: number(parsed.salaryMax),
    openings: Math.max(1, number(parsed.openings) || 1),
    requiredSkills: skills(parsed.requiredSkills),
    rawContent,
  }
}

async function repairExtractionJson(
  invalidResponse: string,
  fallbackRawContent: string,
  sourceFileName?: string,
) {
  const response = await generateAIText({
    maxTokens: 1800,
    json: true,
    system: 'Convert JD extraction output into one valid JSON object only. Never include markdown or commentary.',
    prompt: `Return one valid JSON object matching this schema:
{"title":"","client":"Tahaluf","location":null,"employmentType":null,"experienceMin":null,"experienceMax":null,"salaryMin":null,"salaryMax":null,"openings":1,"requiredSkills":[],"rawContent":""}
Use null for unknown optional fields. Keep all facts from the previous output and source text.
File: ${sourceFileName || 'unknown'}
Previous output:
${compact(invalidResponse, 8000)}
Source text:
${compact(fallbackRawContent, 8000) || 'Not available'}`,
  })

  return parseJsonObject(response.text || '{}')
}

async function parseExtractionResponse(
  responseText: string,
  fallbackRawContent: string,
  sourceFileName?: string,
) {
  try {
    return normalizeExtraction(parseJsonObject(responseText || '{}'), fallbackRawContent)
  } catch {
    try {
      return normalizeExtraction(await repairExtractionJson(responseText, fallbackRawContent, sourceFileName), fallbackRawContent)
    } catch {
      return normalizeExtraction({}, fallbackRawContent || stripJsonFences(responseText))
    }
  }
}

export async function extractJobDescriptionFields(rawContent: string, sourceFileName?: string): Promise<ExtractedJobDescription> {
  const sourceText = rawContent.trim()
  if (!sourceText) throw new Error('JD document did not contain readable text')

  const response = await generateAIText({
    maxTokens: 1600,
    json: true,
    system: 'You extract job description fields for an ATS. Return valid JSON only. Preserve facts and do not invent missing details.',
    prompt: `Extract editable JD fields from this document.
Return JSON:
{"title":"","client":"Tahaluf","location":null,"employmentType":null,"experienceMin":null,"experienceMax":null,"salaryMin":null,"salaryMax":null,"openings":1,"requiredSkills":[],"rawContent":""}
Rules:
- Use null for unknown optional fields.
- Use integers for experience, salary, and openings.
- requiredSkills should contain concise skill names only.
- rawContent should be a clean plain-text version of the uploaded JD.
File: ${sourceFileName || 'unknown'}
JD text:
${sourceText.slice(0, 14000)}`,
  })

  return parseExtractionResponse(response.text || '', sourceText, sourceFileName)
}

export async function extractJobDescriptionFieldsFromDocument(
  buffer: Buffer,
  mimeType: string,
  sourceFileName?: string,
): Promise<ExtractedJobDescription> {
  const response = await generateAIText({
    maxTokens: 1800,
    json: true,
    system: 'You extract job description fields from uploaded documents for an ATS. Return valid JSON only. Preserve facts and do not invent missing details.',
    inlineData: {
      mimeType,
      data: buffer.toString('base64'),
    },
    prompt: `Extract editable JD fields from the attached document.
Return JSON:
{"title":"","client":"Tahaluf","location":null,"employmentType":null,"experienceMin":null,"experienceMax":null,"salaryMin":null,"salaryMax":null,"openings":1,"requiredSkills":[],"rawContent":""}
Rules:
- Use null for unknown optional fields.
- Use integers for experience, salary, and openings.
- requiredSkills should contain concise skill names only.
- rawContent should be a clean plain-text version of the uploaded JD.
File: ${sourceFileName || 'unknown'}`,
  })

  return parseExtractionResponse(response.text || '', '', sourceFileName)
}

export function composeJobDescriptionDraft(data: ExtractedJobDescription) {
  const lines = [
    `Role title: ${data.title}`,
    `Client: ${data.client}`,
    data.location ? `Location: ${data.location}` : '',
    data.employmentType ? `Employment type: ${data.employmentType}` : '',
    data.experienceMin != null || data.experienceMax != null
      ? `Experience: ${data.experienceMin ?? 'Not specified'}-${data.experienceMax ?? 'Not specified'} years`
      : '',
    data.salaryMin != null || data.salaryMax != null
      ? `Salary: AED ${data.salaryMin ?? 'Not specified'}-${data.salaryMax ?? 'Not specified'} per month`
      : '',
    `Openings: ${data.openings}`,
    data.requiredSkills.length ? `Required skills: ${data.requiredSkills.join(', ')}` : '',
    '',
    data.rawContent,
  ]

  return lines.filter(line => line !== '').join('\n')
}
