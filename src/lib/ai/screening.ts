import { generateAIText } from '@/lib/ai/provider'

export interface ScreeningConfig {
  skillWeight: number
  availabilityWeight: number
  locationWeight: number
  minMatchScore: number
  gapThresholdMonths: number
  maxNoticeDays: number
  preferredLocations: string[]
  requiredSkills: string[]
}

export interface RedFlag {
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  description: string
  excerpt: string
}

export interface ScreeningCriterionScore {
  label: string
  score: number
  justification: string
}

export interface ScreeningResult {
  skillScore: number
  availabilityScore: number
  locationScore: number
  experienceScore: number
  educationScore: number
  compositeScore: number
  recommendation: 'SHORTLIST' | 'REVIEW' | 'REJECT'
  redFlags: RedFlag[]
  extractedSkills: string[]
  screeningCallChecklist: string[]
  summary: string
  justification: string
  strengths: string[]
  weaknesses: string[]
  missingSkills: string[]
  criteriaScores: ScreeningCriterionScore[]
}

function parseJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('AI screening returned invalid JSON')
  }
}

function compact(value: string, maxChars: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text
}

function score(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, Math.round(number)))
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

export async function polishJobDescription(rawJD: string): Promise<string> {
  const response = await generateAIText({
    maxTokens: 2000,
    prompt: `You are an expert HR professional. Polish this bare-bones job description into a well-structured, detailed, and attractive job posting.

Structure with sections:
1. **Role Overview** - 2-3 sentences
2. **Key Responsibilities** - 6-8 bullet points
3. **Required Skills** - must-have vs nice-to-have
4. **Qualifications** - education, certifications
5. **What We Offer** - benefits, growth

Maintain all facts. Output ONLY the polished JD in markdown.

RAW JD:
${rawJD}`,
  })

  return response.text || rawJD
}

export async function screenResume(
  resumeText: string,
  jdContent: string,
  config: ScreeningConfig,
  candidateName: string,
): Promise<ScreeningResult> {
  if (!resumeText.trim()) throw new Error('Candidate profile is empty')

  const response = await generateAIText({
    maxTokens: 2500,
    json: true,
    system: 'Senior technical recruiter. Screen deeply but concisely. Output only valid JSON. Use provided ATS profile/resume facts as evidence; do not reject just because raw resume text is unavailable. Do not invent facts.',
    prompt: `Compare candidate profile/resume to JD and config. Scores are 0-100. If a field is missing, score only that criterion conservatively; still evaluate available skills, title, company, experience, education, and location facts.
JD: ${compact(jdContent, 7000)}
Candidate: ${candidateName}
Candidate profile/resume: ${compact(resumeText, 12000)}
Config: requiredSkills=${config.requiredSkills.join(', ') || 'derive from JD'}; preferredLocations=${config.preferredLocations.join(', ') || 'any'}; maxNoticeDays=${config.maxNoticeDays}; flagGapsMonths>${config.gapThresholdMonths}; weights skill=${config.skillWeight}, availability=${config.availabilityWeight}, location=${config.locationWeight}.
Return JSON:
{"skillScore":0,"availabilityScore":0,"locationScore":0,"experienceScore":0,"educationScore":0,"recommendation":"SHORTLIST|REVIEW|REJECT","summary":"","justification":"","strengths":[],"weaknesses":[],"missingSkills":[],"extractedSkills":[],"criteriaScores":[{"label":"Skill match","score":0,"justification":""},{"label":"Experience match","score":0,"justification":""},{"label":"Education match","score":0,"justification":""},{"label":"Availability fit","score":0,"justification":""},{"label":"Location match","score":0,"justification":""}],"redFlags":[{"type":"missing_skill|employment_gap|job_hopping|overqualified|underqualified|location_mismatch|notice_period|vague_education|other","severity":"INFO|WARNING|CRITICAL","description":"","excerpt":""}],"screeningCallChecklist":[]}`,
  })

  const result = parseJson(response.text || '{}')
  const skillScore = score(result.skillScore)
  const availabilityScore = score(result.availabilityScore)
  const locationScore = score(result.locationScore)
  const experienceScore = score(result.experienceScore)
  const educationScore = score(result.educationScore)
  const compositeScore = (
    skillScore * Number(config.skillWeight) / 100 +
    availabilityScore * Number(config.availabilityWeight) / 100 +
    locationScore * Number(config.locationWeight) / 100
  )
  const recommendation = ['SHORTLIST', 'REVIEW', 'REJECT'].includes(result.recommendation)
    ? result.recommendation
    : Math.round(compositeScore) >= config.minMatchScore ? 'SHORTLIST' : 'REVIEW'

  return {
    skillScore,
    availabilityScore,
    locationScore,
    experienceScore,
    educationScore,
    compositeScore: Math.round(compositeScore),
    recommendation,
    redFlags: Array.isArray(result.redFlags) ? result.redFlags : [],
    extractedSkills: stringArray(result.extractedSkills),
    screeningCallChecklist: stringArray(result.screeningCallChecklist),
    summary: String(result.summary || ''),
    justification: String(result.justification || ''),
    strengths: stringArray(result.strengths),
    weaknesses: stringArray(result.weaknesses),
    missingSkills: stringArray(result.missingSkills),
    criteriaScores: Array.isArray(result.criteriaScores)
      ? result.criteriaScores.map((item: any) => ({
        label: String(item.label || 'Criteria'),
        score: score(item.score),
        justification: String(item.justification || ''),
      }))
      : [],
  }
}
