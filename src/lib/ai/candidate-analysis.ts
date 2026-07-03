import { generateAIText } from '@/lib/ai/provider'

export interface CandidateAnalysisFlag {
  type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  description: string
  excerpt?: string
}

export interface CandidateAnalysisResult {
  overallScore: number
  skillScore: number
  availabilityScore: number
  locationScore: number
  summary: string
  screeningNotes: string
  strengths: string[]
  risks: string[]
  flags: CandidateAnalysisFlag[]
  screeningQuestions: string[]
  missingFields: string[]
  recommendedNextStep: string
  provider: string
  model: string
  generatedAt: string
}

const analysisSchema = `{
  "overallScore": 0,
  "skillScore": 0,
  "availabilityScore": 0,
  "locationScore": 0,
  "summary": "",
  "screeningNotes": "",
  "strengths": [],
  "risks": [],
  "flags": [{ "type": "NOTICE_PERIOD|LOCATION|COMPENSATION|CAREER_GAP|ROLE_FIT|MISSING_INFO|OTHER", "severity": "INFO|WARNING|CRITICAL", "description": "", "excerpt": null }],
  "screeningQuestions": [],
  "missingFields": [],
  "recommendedNextStep": ""
}`

function compactText(value: string, maxChars: number) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text
}

function parseJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
  }

  try {
    const start = cleaned.indexOf('{')
    if (start >= 0) {
      let depth = 0
      let inString = false
      let escaped = false
      for (let index = start; index < cleaned.length; index++) {
        const char = cleaned[index]
        if (escaped) {
          escaped = false
          continue
        }
        if (inString && char === '\\') {
          escaped = true
          continue
        }
        if (char === '"') inString = !inString
        if (inString) continue
        if (char === '{') depth++
        if (char === '}') depth--
        if (depth === 0) return JSON.parse(cleaned.slice(start, index + 1))
      }
    }
  } catch {
  }

  throw new Error('AI candidate analysis returned invalid JSON')
}

function fallbackCandidateAnalysis({
  candidateProfile,
  jdContext,
  provider,
  model,
}: {
  candidateProfile: string
  jdContext?: string
  provider: string
  model: string
}): CandidateAnalysisResult {
  const profileLower = candidateProfile.toLowerCase()
  const hasEmail = /email:\s*(?!not provided)/i.test(candidateProfile)
  const hasPhone = /phone:\s*(?!not provided)/i.test(candidateProfile)
  const hasLocation = /location:\s*(?!not provided)/i.test(candidateProfile)
  const hasExperience = /experience years:\s*(?!not provided)/i.test(candidateProfile) || /experience:/i.test(candidateProfile)
  const hasSkills = /skills:\s*(?!not provided)/i.test(candidateProfile)
  const hasNotice = /notice period days:\s*(?!not provided)/i.test(candidateProfile) || /availability/i.test(profileLower)
  const hasCompensation = /expected salary:\s*(?!not provided)/i.test(candidateProfile) || /salary/i.test(profileLower)
  const completeness = [hasEmail, hasPhone, hasLocation, hasExperience, hasSkills, hasNotice, hasCompensation].filter(Boolean).length
  const baseScore = Math.max(45, Math.min(78, 40 + completeness * 6 + (jdContext ? 4 : 0)))
  const missingFields = [
    !hasEmail && 'email',
    !hasPhone && 'phone',
    !hasLocation && 'location',
    !hasExperience && 'experience',
    !hasSkills && 'skills',
    !hasNotice && 'notice period',
    !hasCompensation && 'compensation',
  ].filter(Boolean) as string[]

  const flags: CandidateAnalysisFlag[] = missingFields.slice(0, 4).map(field => ({
    type: 'MISSING_INFO',
    severity: 'WARNING',
    description: `Candidate profile is missing ${field} details. Confirm this during HR screening.`,
  }))

  return {
    overallScore: baseScore,
    skillScore: hasSkills ? baseScore : Math.max(35, baseScore - 12),
    availabilityScore: hasNotice ? baseScore : Math.max(35, baseScore - 10),
    locationScore: hasLocation ? baseScore : Math.max(35, baseScore - 10),
    summary: 'AI returned malformed JSON, so TalentFlow generated a conservative screening pack from available candidate fields.',
    screeningNotes: 'Use this as a fallback HR screening guide. Confirm missing details before moving the candidate forward.',
    strengths: [
      hasExperience ? 'Candidate profile includes experience history.' : 'Candidate has enough profile data to begin HR screening.',
      hasSkills ? 'Skills are available for initial recruiter review.' : 'Recruiter can validate skills during the screening call.',
    ],
    risks: missingFields.length ? missingFields.map(field => `Missing ${field} details.`).slice(0, 8) : ['No major profile completeness risks detected from available fields.'],
    flags,
    screeningQuestions: [
      'Can you briefly walk me through your current role and responsibilities?',
      'What is your current notice period and earliest joining availability?',
      'What are your current and expected compensation details?',
      'Are you comfortable with the role location or any relocation needs?',
      'What is motivating you to consider a new opportunity now?',
      'Are there any work authorization or visa constraints we should know about?',
      'Can you confirm the best email and phone number for interview coordination?',
    ],
    missingFields,
    recommendedNextStep: 'Proceed with HR screening call and validate missing details.',
    provider,
    model,
    generatedAt: new Date().toISOString(),
  }
}

async function repairCandidateAnalysisJson({
  invalidResponse,
  candidateProfile,
  jdContext,
}: {
  invalidResponse: string
  candidateProfile: string
  jdContext?: string
}) {
  return generateAIText({
    json: true,
    maxTokens: 2400,
    system: 'Convert candidate analysis output into valid JSON only. Never include markdown, comments, trailing commas, or extra text.',
    prompt: `Return exactly one valid JSON object matching this schema:
${analysisSchema}

Rules:
- Preserve usable facts from the invalid output.
- If a field is unknown, use 0, "", [], or null as appropriate.
- Generate 5-10 non-technical HR screening questions.
- Do not invent candidate facts.

Invalid previous output:
${compactText(invalidResponse, 6000)}

Candidate profile:
${compactText(candidateProfile, 9000)}

${jdContext ? `Job description context:\n${compactText(jdContext, 3000)}` : 'No JD is linked.'}`,
  })
}

function score(value: unknown, fallback = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.min(100, Math.round(number)))
}

function stringArray(value: unknown, limit = 10) {
  return Array.isArray(value)
    ? value.map(item => String(item).trim()).filter(Boolean).slice(0, limit)
    : []
}

function normalizeFlags(value: unknown): CandidateAnalysisFlag[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).map((item: any) => ({
    type: String(item?.type || 'HR_REVIEW').trim() || 'HR_REVIEW',
    severity: ['INFO', 'WARNING', 'CRITICAL'].includes(String(item?.severity))
      ? item.severity
      : 'WARNING',
    description: String(item?.description || '').trim(),
    excerpt: item?.excerpt ? String(item.excerpt).trim() : undefined,
  })).filter(flag => flag.description)
}

export async function analyzeCandidateProfile({
  candidateProfile,
  jdContext,
}: {
  candidateProfile: string
  jdContext?: string
}): Promise<CandidateAnalysisResult> {
  let response = await generateAIText({
    json: true,
    maxTokens: 2400,
    prompt: `You are an HR screening assistant for TalentFlow AI.

Analyze this candidate profile for a recruiter screening call. Use only the supplied profile and optional JD. Do not invent facts.

Return strict JSON only with:
${analysisSchema}

Question rules:
- Generate 5-10 questions useful for HR in a first screening call.
- Questions must be non-technical.
- Focus on availability, notice period, location/relocation, compensation expectations, role interest, career gaps, current employment, communication, work authorization, and flags.
- If information is missing, ask a confirmation question instead of assuming.

Candidate profile:
${candidateProfile}

${jdContext ? `Job description context:\n${jdContext}` : 'No JD is linked. Score role fit from candidate completeness and likely HR readiness only.'}`,
  })

  let parsed: any
  try {
    parsed = parseJson(response.text)
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('invalid JSON')) throw error
    try {
      response = await repairCandidateAnalysisJson({
        invalidResponse: response.text,
        candidateProfile,
        jdContext,
      })
      parsed = parseJson(response.text)
    } catch (repairError) {
      if (!(repairError instanceof Error) || !repairError.message.includes('invalid JSON')) throw repairError
      return fallbackCandidateAnalysis({
        candidateProfile,
        jdContext,
        provider: response.provider,
        model: response.model,
      })
    }
  }
  const fallbackScore = score(parsed.overallScore, 50)
  const questions = stringArray(parsed.screeningQuestions, 10)
  const defaultQuestions = [
    'Can you briefly walk me through your current role and responsibilities?',
    'What is your current notice period and earliest joining availability?',
    'What are your current and expected compensation details?',
    'Are you comfortable with the role location or any relocation needs?',
    'What is motivating you to consider a new opportunity now?',
  ]

  return {
    overallScore: score(parsed.overallScore, fallbackScore),
    skillScore: score(parsed.skillScore, fallbackScore),
    availabilityScore: score(parsed.availabilityScore, fallbackScore),
    locationScore: score(parsed.locationScore, fallbackScore),
    summary: String(parsed.summary || '').trim(),
    screeningNotes: String(parsed.screeningNotes || '').trim(),
    strengths: stringArray(parsed.strengths, 8),
    risks: stringArray(parsed.risks, 8),
    flags: normalizeFlags(parsed.flags),
    screeningQuestions: (questions.length >= 5 ? questions : [...questions, ...defaultQuestions]).slice(0, 10),
    missingFields: stringArray(parsed.missingFields, 10),
    recommendedNextStep: String(parsed.recommendedNextStep || 'Review with HR screening call').trim(),
    provider: response.provider,
    model: response.model,
    generatedAt: new Date().toISOString(),
  }
}
