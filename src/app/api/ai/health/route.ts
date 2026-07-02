import { requireAuth, ok, err, handleError } from '@/lib/api-utils'
import { generateAIText } from '@/lib/ai/provider'

export async function GET() {
  try {
    const { error } = await requireAuth(['SUPER_ADMIN', 'CSO', 'DIR_TECH', 'HR'])
    if (error) return error

    const result = await generateAIText({
      json: true,
      maxTokens: 64,
      prompt: 'Return JSON only: {"ok":true}',
    })

    return ok({
      provider: result.provider,
      model: result.model,
      ok: /ok/i.test(result.text),
    })
  } catch (e) {
    if (e instanceof Error) return err(e.message, 500)
    return handleError(e)
  }
}
