import { generateAIText } from '@/lib/ai/provider'

export interface InternalResourceAssessmentInput {
  employeeIdRef?: string
  fullName?: string
  currentTitle?: string
  skills?: string
  availability?: string
  diversionType?: string
  allocationPercent?: number
  billingRate?: number
  acsMonthlyCost?: number
  jdTitle?: string
  jdContent?: string | null
  jdSkills?: unknown
}

export interface InternalResourceAssessment {
  fitScore: number
  recommendedDiversionType: 'FULL' | 'PARTIAL' | 'TEMPORARY'
  recommendedAllocationPercent: number
  summary: string
  suggestedNotes: string
  strengths: string[]
  risks: string[]
  screeningNotes: string
  marginCommentary: string
}

function compact(value: string | null | undefined, maxChars = 2500) {
  if (!value) return ''
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text
}

function parseJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('AI internal resource assessment returned invalid JSON')
  }
}

export async function assessInternalResource(input: InternalResourceAssessmentInput): Promise<InternalResourceAssessment> {
  const response = await generateAIText({
    maxTokens: 900,
    json: true,
    system: 'You assess internal employee diversion for staffing. Output only valid JSON. Be concise, factual, and commercially aware.',
    prompt: `Assess this ACS employee for diversion to Tahaluf.
Employee: ${input.fullName || 'Unknown'} (${input.employeeIdRef || 'N/A'}), title=${input.currentTitle || 'N/A'}, skills=${input.skills || 'N/A'}, availability=${input.availability || 'N/A'}, requestedType=${input.diversionType || 'N/A'}, allocation=${input.allocationPercent || 100}%.
Commercials: billingAED=${input.billingRate || 0}, costAED=${input.acsMonthlyCost || 0}.
Target JD: ${input.jdTitle || 'N/A'}, skills=${JSON.stringify(input.jdSkills || [])}, content=${compact(input.jdContent)}.
Return {"fitScore":0-100,"recommendedDiversionType":"FULL|PARTIAL|TEMPORARY","recommendedAllocationPercent":0-100,"summary":"","suggestedNotes":"","strengths":[],"risks":[],"screeningNotes":"","marginCommentary":""}`,
  })

  const raw = parseJson(response.text || '{}')
  const fitScore = Math.max(0, Math.min(100, Number(raw.fitScore) || 0))
  const allocation = Math.max(0, Math.min(100, Number(raw.recommendedAllocationPercent) || input.allocationPercent || 100))
  const type = ['FULL', 'PARTIAL', 'TEMPORARY'].includes(raw.recommendedDiversionType)
    ? raw.recommendedDiversionType
    : input.diversionType || 'FULL'

  return {
    fitScore,
    recommendedDiversionType: type,
    recommendedAllocationPercent: allocation,
    summary: String(raw.summary || ''),
    suggestedNotes: String(raw.suggestedNotes || ''),
    strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
    risks: Array.isArray(raw.risks) ? raw.risks.map(String) : [],
    screeningNotes: String(raw.screeningNotes || ''),
    marginCommentary: String(raw.marginCommentary || ''),
  }
}
