import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export type AIProvider = 'anthropic' | 'gemini' | 'ollama'

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
  usage?: AIUsageDetails
}

function resolveProvider(): AIProvider {
  const configured = process.env.AI_PROVIDER?.toLowerCase()
  if (configured === 'ollama') return 'ollama'
  if (configured === 'gemini') return 'gemini'
  if (configured === 'anthropic' || configured === 'claude') return 'anthropic'
  // Local Ollama is the default — no API key, no quota, no cost.
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  return 'ollama'
}

function resolveModel(provider: AIProvider) {
  if (provider === 'ollama') return process.env.AI_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:3b-instruct'

  const model = process.env.AI_MODEL || (provider === 'gemini'
    ? process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    : process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6')

  return provider === 'gemini' ? model.replace(/^models\//, '') : model
}

interface ProviderTextResult {
  text: string
  model: string
  usage?: AIUsageDetails
}

async function generateWithAnthropic(options: GenerateAITextOptions, model: string): Promise<ProviderTextResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured')

  const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropicClient.messages.create({
    model,
    max_tokens: options.maxTokens || 2000,
    ...(options.system && { system: options.system }),
    messages: [{ role: 'user', content: options.prompt }],
  })

  const text = response.content
    .filter(part => part.type === 'text')
    .map(part => part.type === 'text' ? part.text : '')
    .join('\n')

  return {
    text,
    model,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      metadata: {
        stopReason: response.stop_reason,
      },
    },
  }
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
  const usageMetadata = data?.usageMetadata || {}

  return {
    ok: true as const,
    text,
    model: candidateModel,
    usage: {
      promptTokens: Number(usageMetadata.promptTokenCount || 0),
      completionTokens: Number(usageMetadata.candidatesTokenCount || 0),
      totalTokens: Number(usageMetadata.totalTokenCount || 0),
      cachedTokens: usageMetadata.cachedContentTokenCount == null
        ? undefined
        : Number(usageMetadata.cachedContentTokenCount),
      metadata: {
        thoughtsTokenCount: usageMetadata.thoughtsTokenCount,
        promptTokensDetails: usageMetadata.promptTokensDetails,
        candidatesTokensDetails: usageMetadata.candidatesTokensDetails,
      },
    },
  }
}

async function generateWithGemini(options: GenerateAITextOptions, model: string): Promise<ProviderTextResult> {
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
      if (result.ok) return { text: result.text, model: result.model, usage: result.usage }

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

const OLLAMA_WARMUP_RETRY_DELAYS_MS = [3000, 6000, 12000]

async function callOllama(baseUrl: string, model: string, options: GenerateAITextOptions) {
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || 600_000
  const numCtx = Number(process.env.OLLAMA_NUM_CTX) || 8192
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          ...(options.system ? [{ role: 'system', content: options.system }] : []),
          { role: 'user', content: options.prompt },
        ],
        ...(options.json && { format: 'json' }),
        options: {
          num_predict: options.maxTokens || 2000,
          num_ctx: numCtx,
          temperature: 0.2,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const notPulled = response.status === 404 && /not found|try pulling/i.test(errorText)
      return { ok: false as const, notPulled, connRefused: false, timedOut: false, message: `Ollama API error ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    const text = data?.message?.content
    if (!text) return { ok: false as const, notPulled: false, connRefused: false, timedOut: false, message: 'Ollama API returned no text' }
    return { ok: true as const, text }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    const isConnRefused = error instanceof Error && /ECONNREFUSED|fetch failed/i.test(error.message)
    return {
      ok: false as const,
      notPulled: false,
      connRefused: isConnRefused,
      timedOut: isAbort,
      message: isAbort
        ? `Ollama request timed out after ${timeoutMs}ms (model may still be loading, or this prompt is slow on CPU)`
        : `Ollama connection error: ${error instanceof Error ? error.message : String(error)}`,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function generateWithOllama(options: GenerateAITextOptions, model: string): Promise<string> {
  if (options.inlineData) {
    // Local text-only models can't accept Gemini-style inline binary (PDF/DOCX) input.
    // Callers already fall back to a non-AI extraction path on any AI failure here.
    throw new Error('OLLAMA_NO_MULTIMODAL: local Ollama models do not support inline document input')
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://ollama:11434').replace(/\/$/, '')
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= OLLAMA_WARMUP_RETRY_DELAYS_MS.length; attempt++) {
    const result = await callOllama(baseUrl, model, options)
    if (result.ok) return result.text

    if (result.notPulled) {
      throw new Error(`Ollama model "${model}" is not pulled yet. Wait for the ollama-setup service to finish, or run 'ollama pull ${model}'.`)
    }

    if (result.connRefused && attempt < OLLAMA_WARMUP_RETRY_DELAYS_MS.length) {
      // The Ollama container may still be starting up — retry with backoff.
      lastError = new Error(result.message)
      await sleep(OLLAMA_WARMUP_RETRY_DELAYS_MS[attempt])
      continue
    }

    // Timeouts and other errors are not retried — retrying an already-slow call just doubles the wait.
    throw new Error(result.message)
  }

  throw lastError || new Error('Ollama API request failed')
}

export async function generateAIText(options: GenerateAITextOptions): Promise<GenerateAITextResult> {
  const startedAt = Date.now()
  const provider = resolveProvider()
  const model = resolveModel(provider)
  const text = provider === 'ollama'
    ? await generateWithOllama(options, model)
    : provider === 'gemini'
      ? await generateWithGemini(options, model)
      : await generateWithAnthropic(options, model)

  await recordAIUsage(provider, result, options, Date.now() - startedAt)

  return { text: result.text, provider, model: result.model, usage: result.usage }
}
