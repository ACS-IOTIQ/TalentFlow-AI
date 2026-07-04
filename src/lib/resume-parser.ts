import mammoth from 'mammoth'
import unzipper from 'unzipper'
import { Readable } from 'stream'

// pdfjs-dist's legacy Node build is ESM-only; import dynamically to avoid
// bundler/CJS interop issues in Next.js's server build.
async function loadPdfJs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs')
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await loadPdfJs()

    // No standardFontDataUrl: that's only used for glyph-metric fallback during
    // rendering. We only read text content, so its absence is a harmless warning.
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise

    const pageTexts: string[] = []
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pageTexts.push(content.items.map((item: any) => item.str || '').join(' '))
    }

    return pageTexts.join('\n').replace(/[ \t]+/g, ' ').trim()
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

const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Java', 'C#',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'AWS', 'Azure', 'Docker', 'Kubernetes',
  'DevOps', 'CI/CD', 'Git', 'REST', 'GraphQL', 'HTML', 'CSS', 'Tailwind', 'Angular',
  'Vue', 'Spring', '.NET', 'PHP', 'Laravel', 'Django', 'Flask', 'Power BI', 'Tableau',
  'Excel', 'Project Management', 'Agile', 'Scrum', 'Business Analysis', 'Testing',
  'QA', 'Selenium', 'Cypress', 'Jira', 'Figma', 'UI/UX', 'Data Analysis', 'Machine Learning',
]

function firstMatch(text: string, regex: RegExp) {
  return text.match(regex)?.[1]?.trim()
}

function lines(text: string) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

function inferName(text: string, filename: string) {
  const firstLines = lines(text).slice(0, 8)
  const email = firstMatch(text, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  for (const line of firstLines) {
    if (email && line.includes(email)) continue
    if (/[0-9@:/\\|]/.test(line)) continue
    const words = line.split(/\s+/).filter(Boolean)
    if (words.length >= 2 && words.length <= 5 && words.every(word => /^[A-Za-z.'-]+$/.test(word))) {
      return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }
  }
  return inferNameFromFilename(filename)
}

function extractSkills(text: string) {
  const lower = text.toLowerCase()
  return COMMON_SKILLS
    .filter(skill => lower.includes(skill.toLowerCase()))
    .map(name => ({ name, proficiency: undefined as string | undefined, yearsUsed: undefined as number | undefined }))
}

function extractSection(text: string, title: string) {
  const pattern = new RegExp(`(?:^|\\n)\\s*${title}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:experience|education|skills|projects|certifications|summary|profile|employment|languages)\\s*:?\\s*\\n|$)`, 'i')
  return firstMatch(text, pattern)
}

function sectionItems(text: string, title: string) {
  return (extractSection(text, title) || '')
    .split(/\n|•|-/)
    .map(item => item.trim())
    .filter(item => item.length > 3)
    .slice(0, 12)
}

function inferExperienceYears(text: string) {
  const direct = firstMatch(text, /(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:total\s+)?experience/i)
  if (direct) return Number(direct)
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map(match => Number(match[0])).filter(year => year <= new Date().getFullYear())
  if (years.length >= 2) return Math.max(0, new Date().getFullYear() - Math.min(...years))
  return undefined
}

function completeness(fields: Record<string, unknown>, skills: unknown[]) {
  const keys = ['fullName', 'email', 'phone', 'location', 'currentTitle', 'currentCompany', 'totalExperienceYears']
  const filled = keys.filter(key => Boolean(fields[key])).length
  return Math.min(95, Math.round((filled / keys.length) * 70 + Math.min(skills.length, 8) * 3))
}

export function parseResumeHeuristically(text: string, filename: string) {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()
  const email = firstMatch(normalized, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  const phone = firstMatch(normalized, /(\+?\d[\d\s().-]{7,}\d)/)
  const linkedinUrl = firstMatch(normalized, /(https?:\/\/(?:www\.)?linkedin\.com\/[^\s,;]+)/i)
  const notice = firstMatch(normalized, /notice\s*period[^0-9]*(\d{1,3})\s*(?:days?|d)?/i)
  const salary = firstMatch(normalized, /(?:expected|current)?\s*(?:ctc|salary|compensation)[^0-9]*(\d[\d,]*)/i)
  const standardFields = {
    fullName: inferName(normalized, filename),
    email,
    phone,
    location: firstMatch(normalized, /(?:location|address|based in)\s*:?\s*([A-Za-z ,.-]{3,60})/i),
    currentTitle: firstMatch(normalized, /(?:current\s+title|designation|role)\s*:?\s*([A-Za-z0-9 /&+.-]{3,80})/i),
    currentCompany: firstMatch(normalized, /(?:current\s+company|employer|organization)\s*:?\s*([A-Za-z0-9 /&+.-]{2,80})/i),
    totalExperienceYears: inferExperienceYears(normalized),
    noticePeriodDays: notice ? Number(notice) : undefined,
    expectedSalary: salary ? Number(salary.replace(/,/g, '')) : undefined,
    linkedinUrl,
  }
  const skills = extractSkills(normalized)
  const missingFields = Object.entries(standardFields).filter(([, value]) => !value).map(([key]) => key)

  return {
    standardFields,
    skills,
    dynamicDetails: {
      summary: sectionItems(normalized, 'summary').join(' ') || sectionItems(normalized, 'profile').join(' '),
      experience: sectionItems(normalized, 'experience'),
      education: sectionItems(normalized, 'education'),
      certifications: sectionItems(normalized, 'certifications'),
      projects: sectionItems(normalized, 'projects'),
      languages: sectionItems(normalized, 'languages'),
      links: linkedinUrl ? [linkedinUrl] : [],
      concerns: missingFields.slice(0, 6).map(field => ({
        type: 'missing_field',
        severity: 'INFO',
        description: `Manual parser could not confidently extract ${field}. HR should verify it.`,
      })),
    },
    extractionMeta: {
      schemaVersion: '1.0',
      provider: 'manual-parser',
      model: 'regex-heuristics',
      extractedAt: new Date().toISOString(),
      confidence: completeness(standardFields, skills),
      missingFields,
      status: 'PARSED',
      sourceFileName: filename,
    },
  }
}
