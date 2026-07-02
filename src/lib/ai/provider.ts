import Anthropic from '@anthropic-ai/sdk'

export type AIProvider = 'anthropic' | 'gemini'

export interface GenerateAITextOptions {
  system?: string
  prompt: string
  maxTokens?: number
  json?: boolean
  inlineData?: {
    mimeType: string
    data: string
  }
}

export interface GenerateAITextResult {
  text: string
  provider: AIProvider
  model: string
}

function resolveProvider(): AIProvider {
  const configured = process.env.AI_PROVIDER?.toLowerCase()
  if (configured === 'gemini') return 'gemini'
  if (configured === 'anthropic' || configured === 'claude') return 'anthropic'
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini'
  return 'anthropic'
}

function resolveModel(provider: AIProvider) {
  const model = process.env.AI_MODEL || (provider === 'gemini'
    ? process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    : process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6')

  return provider === 'gemini' ? model.replace(/^models\//, '') : model
}

async function generateWithAnthropic(options: GenerateAITextOptions, model: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')

  const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropicClient.messages.create({
    model,
    max_tokens: options.maxTokens || 2000,
    ...(options.system && { system: options.system }),
    messages: [{ role: 'user', content: options.prompt }],
  })

  return response.content
    .filter(part => part.type === 'text')
    .map(part => part.type === 'text' ? part.text : '')
    .join('\n')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function retryDelaySeconds(errorText: string): number | null {
  const match = errorText.match(/retry in ([\d.]+)s/i)
  return match ? Number(match[1]) : null
}

const RATE_LIMIT_RETRY_DELAYS_MS = [2000, 4000]

async function callGemini(baseUrl: string, apiKey: string, candidateModel: string, options: GenerateAITextOptions) {
  const response = await fetch(`${baseUrl}/models/${candidateModel}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      ...(options.system && { systemInstruction: { parts: [{ text: options.system }] } }),
      contents: [{
        role: 'user',
        parts: [
          { text: options.prompt },
          ...(options.inlineData ? [{
            inline_data: {
              mime_type: options.inlineData.mimeType,
              data: options.inlineData.data,
            },
          }] : []),
        ],
      }],
      generationConfig: {
        maxOutputTokens: options.maxTokens || 2000,
        ...(options.json && { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }),
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    const message = `Gemini API error ${response.status}: ${errorText}`
    return { ok: false as const, status: response.status, errorText, message }
  }

  const data = await response.json()
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts.map((part: any) => part.text).filter(Boolean).join('\n')
  if (!text) return { ok: false as const, status: 200, errorText: 'no text in response', message: 'Gemini API returned no text' }
  return { ok: true as const, text }
}

async function generateWithGemini(options: GenerateAITextOptions, model: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is not configured')

  const baseUrl = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta'
  const fallbackModel = (process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.0-flash').replace(/^models\//, '')
  const modelsToTry = [model.replace(/^models\//, ''), fallbackModel]
    .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)
  let lastError: Error | null = null

  for (const candidateModel of modelsToTry) {
    // Rate limits (429) are transient and model-specific — retry the same model with
    // backoff instead of immediately burning the attempt on a different model that may
    // have its own (possibly zero) quota.
    for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt++) {
      const result = await callGemini(baseUrl, apiKey, candidateModel, options)
      if (result.ok) return result.text

      lastError = new Error(result.message)

      if (result.status === 404 || /model|not found|unsupported/i.test(result.errorText)) {
        break // try the next candidate model
      }

      if (result.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
        const hinted = retryDelaySeconds(result.errorText)
        const delay = hinted ? Math.min(hinted * 1000, 8000) : RATE_LIMIT_RETRY_DELAYS_MS[attempt]
        await sleep(delay)
        continue // retry the same model
      }

      break // non-retryable error, or retries exhausted — try the next candidate model
    }
  }

  if (lastError) throw lastError
  throw new Error('Gemini API request failed')
}

export async function generateAIText(options: GenerateAITextOptions): Promise<GenerateAITextResult> {
  const provider = resolveProvider()
  const model = resolveModel(provider)
  const text = provider === 'gemini'
    ? await generateWithGemini(options, model)
    : await generateWithAnthropic(options, model)

  return { text, provider, model }
}
