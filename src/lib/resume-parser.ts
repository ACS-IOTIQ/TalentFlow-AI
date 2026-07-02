import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import unzipper from 'unzipper'
import { Readable } from 'stream'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text.trim()
  } catch {
    return ''
  }
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  } catch {
    return ''
  }
}

export async function extractTextFromFile(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return extractTextFromPDF(buffer)
  if (lower.endsWith('.docx')) return extractTextFromDOCX(buffer)
  if (lower.endsWith('.doc')) {
    const docxText = await extractTextFromDOCX(buffer)
    if (docxText) return docxText
    return buffer.toString('utf-8').replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return buffer.toString('utf-8')
}

export interface ExtractedFile {
  filename: string
  buffer: Buffer
  mimeType: string
}

export async function extractFilesFromZip(buffer: Buffer): Promise<ExtractedFile[]> {
  const files: ExtractedFile[] = []
  const readable = Readable.from(buffer)
  const directory = readable.pipe(unzipper.Parse({ forceStream: true }))

  for await (const entry of directory) {
    const { path: filePath, type } = entry as any
    if (type === 'File') {
      const lower = filePath.toLowerCase()
      if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
        const chunks: Buffer[] = []
        for await (const chunk of entry) chunks.push(chunk)
        const fileBuffer = Buffer.concat(chunks)
        const filename = filePath.split('/').pop() || filePath
        files.push({
          filename,
          buffer: fileBuffer,
          mimeType: lower.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      } else {
        entry.autodrain()
      }
    } else {
      entry.autodrain()
    }
  }

  return files
}

export function inferNameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '')
  return base.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim()
}
