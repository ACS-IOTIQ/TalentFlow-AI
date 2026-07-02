import { NextRequest } from 'next/server'
import { requireAuth, ok, err, handleError } from '@/lib/api-utils'
import { extractTextFromFile } from '@/lib/resume-parser'
import { extractJobDescriptionFields, extractJobDescriptionFieldsFromDocument } from '@/lib/ai/jd-extraction'

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

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH'])
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
    const extracted = rawText.trim()
      ? await extractJobDescriptionFields(rawText, file.name)
      : await extractJobDescriptionFieldsFromDocument(buffer, inferMimeType(file), file.name)
    if (!extracted.rawContent.trim()) return err('Could not extract readable text from this JD document', 422)

    return ok({ ...extracted, rawFileName: file.name })
  } catch (e) { return handleError(e) }
}
