// One call to a Groq model, and what its answer says about the model's limits. The request goes in
// as JSON data ({year, request}); no `user` field or anything else that identifies the person is
// ever sent. Deterministic settings (temperature 0, seed 7) so the same request reads the same.
import 'server-only'
import { GROQ_BASE, type ModelChoice } from './config'
import { PLAN_JSON_SCHEMA, SYSTEM_PROMPT, userMessage } from './prompt'
import { parseFirstJson } from './json'

export type GroqLimits = {
  remainingTokens: number | null
  remainingRequests: number | null
  tokensResetAt: Date | null
  requestsResetAt: Date | null
  /** After a 429: when the model may be tried again. */
  blockedUntil: Date | null
}

export type GroqResult =
  | { ok: true, json: unknown, tokens: number, limits: GroqLimits }
  | { ok: false, status: number, reason: 'limited' | 'refused' | 'timeout' | 'network' | 'bad-json', limits: GroqLimits | null, tokens?: number }

/** "2m59.56s", "7.66s", "1h2m3s", "250ms" -> milliseconds (null when unreadable). */
export function parseDuration(value: string | null | undefined): number | null {
  if (!value) return null
  const text = value.trim()
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000)
  const match = /^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+)ms)?$/.exec(text)
  if (!match || !text) return null
  const [, h, m, s, ms] = match
  if (!h && !m && !s && !ms) return null
  return Math.round((Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0)) * 1000 + Number(ms ?? 0))
}

/** The x-ratelimit-* headers (and retry-after after a 429) as limits. */
export function readLimits(headers: Headers, status: number, now = Date.now()): GroqLimits {
  const number = (name: string) => {
    const value = headers.get(name)
    return value != null && /^\d+$/.test(value) ? Number(value) : null
  }
  const at = (ms: number | null) => (ms == null ? null : new Date(now + ms))
  const tokensReset = parseDuration(headers.get('x-ratelimit-reset-tokens'))
  const requestsReset = parseDuration(headers.get('x-ratelimit-reset-requests'))
  const retryAfter = parseDuration(headers.get('retry-after'))
  return {
    remainingTokens: number('x-ratelimit-remaining-tokens'),
    remainingRequests: number('x-ratelimit-remaining-requests'),
    tokensResetAt: at(tokensReset),
    requestsResetAt: at(requestsReset),
    blockedUntil: status === 429 ? at(retryAfter ?? Math.max(tokensReset ?? 0, requestsReset ?? 0, 60_000)) : null,
  }
}

/** The request body for a model (pure, for the tests). */
export function requestBody(model: ModelChoice, request: string, now = new Date()) {
  const body: Record<string, unknown> = {
    model: model.id,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage(request, now) },
    ],
    temperature: 0,
    seed: 7,
    max_completion_tokens: 500,
    response_format: model.mode === 'schema'
      ? { type: 'json_schema', json_schema: { name: 'search_plan', strict: true, schema: PLAN_JSON_SCHEMA } }
      : { type: 'json_object' },
  }
  // Reasoning models: think briefly, and never send the reasoning back.
  if (/gpt-oss/i.test(model.id)) {
    body.reasoning_effort = 'low'
    body.include_reasoning = false
  }
  return body
}

/** Asks one model what `request` means. Never throws. */
export async function callGroq(model: ModelChoice, request: string, timeoutMs: number, now = new Date()): Promise<GroqResult> {
  const key = process.env.GROQ_API_KEY
  if (!key) return { ok: false, status: 0, reason: 'refused', limits: null }
  let response: Response
  try {
    response = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody(model, request, now)),
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.max(500, timeoutMs)),
    })
  } catch (error: any) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return { ok: false, status: 0, reason: timeout ? 'timeout' : 'network', limits: null }
  }
  const limits = readLimits(response.headers, response.status)
  if (response.status === 429) return { ok: false, status: 429, reason: 'limited', limits }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    return { ok: false, status: response.status, reason: 'refused', limits }
  }
  let tokens = 0
  try {
    const data = await response.json()
    tokens = Number(data?.usage?.total_tokens) || 0
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return { ok: false, status: 200, reason: 'bad-json', limits, tokens }
    return { ok: true, json: parseFirstJson(content), tokens, limits }
  } catch {
    return { ok: false, status: 200, reason: 'bad-json', limits, tokens }
  }
}
