// Whether Ask exists at all, and how it talks to Groq (free tier: the org has no payment method,
// so nothing here can ever cost money; a spent quota only means Ask falls back to simple matching).
//
// Environment:
// - GROQ_API_KEY: without it, Ask disappears completely (no chip, no palette item, the route 404s).
// - AI_SEARCH_OFF=1: the same, with the key kept.
// - AI_SEARCH_MODELS: comma-separated model ids, tried in this order (overrides the preference).
// - AI_DAILY_CALLS: model calls per day for the whole site (default 300; guests get 40% of it).

/** Ask is on: a Groq key is set and AI_SEARCH_OFF isn't '1'. */
export function aiSearchEnabled(): boolean {
  return !!process.env.GROQ_API_KEY && process.env.AI_SEARCH_OFF !== '1'
}

/** Bumped whenever the prompt or the plan format changes (it is part of every cache key). */
export const PROMPT_VERSION = 'ai-1'

export const GROQ_BASE = 'https://api.groq.com/openai/v1'

/** Time given to the first model, to each next one, and to the whole interpretation (ms). */
export const TIMEOUTS = { firstModel: 7000, nextModel: 4500, overall: 12000 } as const

/** The default order of models (a sort order, not a filter; AI_SEARCH_MODELS replaces it). */
export const MODEL_PREFERENCE = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']

/** Models that aren't chat models, or not for this (speech, guards, Arabic-only small models, agents). */
const EXCLUDED = /whisper|orpheus|prompt-guard|allam|safeguard|playai|tts|compound/i

/** Model calls per day for the whole site. */
export function dailyCalls(): number {
  const value = Number(process.env.AI_DAILY_CALLS)
  return Number.isInteger(value) && value > 0 ? value : 300
}
/** The share of the daily calls guests may use. */
export const GUEST_SHARE = 0.4

export type ModelChoice = { id: string, mode: 'schema' | 'json' }

/** Models answering with strict structured outputs (json_schema); the others get JSON mode. */
const STRUCTURED = /^openai\/gpt-oss-(?:120b|20b)$|kimi-k2|llama-4/i

/** The preference order: AI_SEARCH_MODELS when set, else MODEL_PREFERENCE. */
function preference(): string[] {
  const custom = (process.env.AI_SEARCH_MODELS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  return custom.length ? custom : MODEL_PREFERENCE
}

/**
 * Orders the models Groq lists (from GET /models): preferred ones first, in preference order, then
 * the rest by name; speech and guard models are left out. Pure, for the tests.
 */
export function orderModels(listed: { id: string, active?: boolean }[], order = preference()): ModelChoice[] {
  const ids = listed.filter((model) => model?.id && model.active !== false && !EXCLUDED.test(model.id)).map((model) => model.id)
  const rank = (id: string) => {
    const index = order.indexOf(id)
    return index < 0 ? order.length : index
  }
  return Array.from(new Set(ids))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((id) => ({ id, mode: STRUCTURED.test(id) ? 'schema' as const : 'json' as const }))
}

/**
 * The models to try, in order. The list only ever comes from Groq's GET /models (cached a day by
 * Next's data cache), so a retired model is never called. Empty when Groq can't be reached.
 */
export async function listModels(): Promise<ModelChoice[]> {
  const key = process.env.GROQ_API_KEY
  if (!key) return []
  try {
    const response = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(3000),
    } as RequestInit)
    if (!response.ok) return []
    const body = await response.json()
    return orderModels(Array.isArray(body?.data) ? body.data : [])
  } catch {
    return []
  }
}
