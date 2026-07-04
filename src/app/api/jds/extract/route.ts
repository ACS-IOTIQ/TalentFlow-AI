import { NextRequest } from 'next/server'
import { requireAuth, ok, err, handleError } from '@/lib/api-utils'
import { extractTextFromFile } from '@/lib/resume-parser'
import { extractJobDescriptionFields, extractJobDescriptionFieldsFromDocument } from '@/lib/ai/jd-extraction'
import { aiFeaturesEnabled } from '@/lib/feature-flags'

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx']

function inferMimeType(file: File) {
  const lowerName = file.name.toLowerCase()
  if (file.type) return file.type
  if (lowerName.endsWith('.pdf')) return 'application/pdf'
  if (lowerName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lowerName.endsWith('.doc')) return 'application/msword'
  return 'application/octet-stream'
}

function extractManualJD(rawText: string, fileName: string) {
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const title = lines.find(line => line.length >= 3 && line.length <= 90 && !/@|http|www\./i.test(line))
    || fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
  const skillHints = [
    'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Java', 'SQL',
    'AWS', 'Azure', 'Docker', 'Kubernetes', 'Agile', 'Scrum', 'Testing', 'Power BI',
  ]
  const lower = rawText.toLowerCase()
  return {
    title,
    client: 'Tahaluf',
    location: rawText.match(/location\s*:?\s*([A-Za-z ,.-]{3,60})/i)?.[1]?.trim() || '',
    employmentType: rawText.match(/\b(full-time|part-time|contract|remote|hybrid)\b/i)?.[1] || '',
    experienceMin: Number(rawText.match(/(\d+)\+?\s*(?:years|yrs)/i)?.[1] || '') || undefined,
    experienceMax: undefined,
    salaryMin: undefined,
    salaryMax: undefined,
    openings: Number(rawText.match(/(\d+)\s*(?:openings|positions|vacancies)/i)?.[1] || '') || 1,
    requiredSkills: skillHints.filter(skill => lower.includes(skill.toLowerCase())),
    rawContent: rawText,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return err('Upload a PDF, DOC, or DOCX job description', 400)
    if (file.size > MAX_FILE_SIZE) return err('JD upload must be 8 MB or smaller', 400)

    const lowerName = file.name.toLowerCase()
    if (!ALLOWED_EXTENSIONS.some(extension => lowerName.endsWith(extension))) {
      return err('Only PDF, DOC, and DOCX files are supported', 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rawText = await extractTextFromFile(buffer, file.name)

    let extracted
    if (!aiFeaturesEnabled()) {
      extracted = extractManualJD(rawText, file.name)
    } else {
      try {
        extracted = rawText.trim()
          ? await extractJobDescriptionFields(rawText, file.name)
          : await extractJobDescriptionFieldsFromDocument(buffer, inferMimeType(file), file.name)
      } catch (e) {
        if (rawText.trim()) {
          extracted = extractManualJD(rawText, file.name)
        } else if (e instanceof Error && e.message.startsWith('OLLAMA_NO_MULTIMODAL')) {
          return err('AI could not read this file directly (scanned/image-based document). Please fill in the JD fields manually.', 422)
        } else {
          throw e
        }
      }
    }

    if (!extracted.rawContent.trim()) return err('Could not extract readable text from this JD document', 422)

    return ok({ ...extracted, rawFileName: file.name })
  } catch (e) { return handleError(e) }
}
