import { NextRequest } from 'next/server'
import { requireAuth, ok, err, handleError } from '@/lib/api-utils'
import { composeJobDescriptionDraft, type ExtractedJobDescription } from '@/lib/ai/jd-extraction'
import { polishJobDescription } from '@/lib/ai/screening'
import { z } from 'zod'

const polishDraftSchema = z.object({
  title: z.string().min(2),
  client: z.string().default('Tahaluf'),
  rawContent: z.string().optional().default(''),
  location: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  experienceMin: z.number().optional().nullable(),
  experienceMax: z.number().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  openings: z.number().min(1).default(1),
  requiredSkills: z.array(z.string()).default([]),
})

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH'])
    if (error) return error

    const data = polishDraftSchema.parse(await req.json())
    const draft = composeJobDescriptionDraft(data as ExtractedJobDescription)
    if (!draft.trim()) return err('Add JD details before polishing', 400)

    const polishedContent = await polishJobDescription(draft)
    return ok({ polishedContent })
  } catch (e) { return handleError(e) }
}
