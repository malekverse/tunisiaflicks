// What a request means: from the cache, else from a model (within the daily budget and every
// limit), else from the simple parser. Obvious titles ("inception") never reach the model: they
// are sent to the title search instead.
import 'server-only'
import { tmdbFetch } from '@/src/lib/tmdb'
import { TIMEOUTS, listModels } from './config'
import { addTokens, cacheKey, countStat, readMeaning, readModelStates, reserveBudget, writeMeaning, writeModelState, type StateDoc } from './cache'
import { callGroq } from './groq'
import { quickPlan } from './heuristic'
import { takeModelSlot } from './limits'
import { looksLikeAsk, normalizeQuery, wordCount } from './normalize'
import { rawHasFacets, sanitizeRawPlan } from './schema'
import type { RawPlan } from './types'

export type Meaning = {
  plan: RawPlan
  /** The plan comes from a model (now or from the cache): its results carry the AI mark. */
  ai: boolean
  source: 'cache' | 'model' | 'parser' | 'title'
  /** The model couldn't be used (budget spent, limits, failure): simple matching answered. */
  resting: boolean
  /** Nothing to discover: show title results for this instead. */
  switchTo: { q: string, reason: 'title' | 'resting' } | null
}

/** Below this many tokens left in a model's minute, the model is skipped until its reset. */
const MIN_TOKENS = 1500
/** At most this many models per request. */
const MAX_MODELS = 3
/** Models that refused a request (retired, bad parameters): skipped for an hour by this instance. */
const refused = new Map<string, number>()

/** Filters beyond the kind and the order: what a search can really narrow on. */
function hasFilters(plan: RawPlan): boolean {
  return rawHasFacets({ ...plan, kind: 'any', sort: 'rel' })
}

function decide(request: string, plan: RawPlan, ai: boolean, source: Meaning['source'], resting: boolean): Meaning {
  let switchTo: Meaning['switchTo'] = null
  if ((plan.intent === 'title' || plan.intent === 'person') && !hasFilters(plan)) switchTo = { q: plan.title ?? request, reason: 'title' }
  else if (!rawHasFacets(plan)) switchTo = { q: request, reason: resting ? 'resting' : 'title' }
  return { plan, ai, source, resting, switchTo }
}

const titleOf = (item: any) => [item?.title, item?.name, item?.original_title, item?.original_name].filter(Boolean).map((value: string) => normalizeQuery(value))

/** Whether the request is exactly the title of a known film or series (no model needed). */
async function isExactTitle(request: string): Promise<boolean> {
  try {
    const data = await tmdbFetch('search/multi', { query: request, include_adult: false }, 3600)
    const wanted = normalizeQuery(request)
    return (data?.results ?? []).slice(0, 5).some((item: any) =>
      (item.media_type === 'movie' || item.media_type === 'tv') && (item.vote_count ?? 0) >= 20 && titleOf(item).includes(wanted))
  } catch {
    return false
  }
}

type ModelAnswer = { plan: RawPlan | null, reason: 'ok' | 'budget' | 'db' | 'unavailable' | 'failed' }

function usable(id: string, state: StateDoc | undefined, now: number): boolean {
  if ((refused.get(id) ?? 0) > now) return false
  if (!state) return true
  if (state.blockedUntil && state.blockedUntil.getTime() > now) return false
  if (state.remainingTokens != null && state.remainingTokens < MIN_TOKENS && state.tokensResetAt && state.tokensResetAt.getTime() > now) return false
  if (state.remainingRequests === 0 && state.requestsResetAt && state.requestsResetAt.getTime() > now) return false
  return true
}

/** Tries the models in order within the overall deadline; each call is paid from the budget first. */
async function askModels(request: string, guest: boolean, now: Date): Promise<ModelAnswer> {
  const started = Date.now()
  const models = await listModels()
  if (!models.length) return { plan: null, reason: 'unavailable' }
  let states: Map<string, StateDoc>
  try {
    states = await readModelStates(models.map((model) => model.id))
  } catch (error) {
    console.error('ai model states unavailable, no model call:', error)
    return { plan: null, reason: 'db' }
  }
  let tried = 0
  for (const model of models) {
    if (tried >= MAX_MODELS) break
    const left = started + TIMEOUTS.overall - Date.now()
    if (left < 1500) break
    if (!usable(model.id, states.get(model.id), Date.now())) continue
    if (!(await takeModelSlot(model.id))) continue
    const budget = await reserveBudget(guest, now)
    if (budget === 'exhausted') {
      countStat('budgetSpent')
      return { plan: null, reason: 'budget' }
    }
    if (budget === 'error') return { plan: null, reason: 'db' }
    tried += 1
    const result = await callGroq(model, request, Math.min(tried === 1 ? TIMEOUTS.firstModel : TIMEOUTS.nextModel, left), now)
    const tokens = result.tokens ?? 0
    if (tokens) void addTokens(tokens, now)
    if (result.limits) {
      const { remainingTokens, remainingRequests, tokensResetAt, requestsResetAt, blockedUntil } = result.limits
      void writeModelState(model.id, {
        ...(remainingTokens != null ? { remainingTokens } : {}),
        ...(remainingRequests != null ? { remainingRequests } : {}),
        ...(tokensResetAt ? { tokensResetAt } : {}),
        ...(requestsResetAt ? { requestsResetAt } : {}),
        ...(blockedUntil ? { blockedUntil } : {}),
      }, now)
    }
    if (result.ok) {
      const plan = sanitizeRawPlan(result.json, request, now)
      if (plan) return { plan, reason: 'ok' }
    } else if ('status' in result && result.status >= 400 && result.status !== 429 && result.status < 500) {
      refused.set(model.id, Date.now() + 60 * 60 * 1000)
    }
    countStat('modelFailures')
  }
  return { plan: null, reason: 'failed' }
}

/**
 * The meaning of a request (already cleaned and scrubbed of personal details). `modelAllowed`:
 * the limits could be counted and allow a model call.
 */
export async function interpret(request: string, o: { guest: boolean, modelAllowed: boolean, now?: Date, cache?: boolean }): Promise<Meaning> {
  const now = o.now ?? new Date()
  const key = cacheKey(normalizeQuery(request), now)

  const cached = o.cache === false ? null : await readMeaning(key)
  if (cached) {
    countStat('cache')
    // The parser's answers are only kept while the model was resting.
    return decide(request, cached.plan, cached.ai, 'cache', !cached.ai && cached.plan.intent === 'discover')
  }

  const { complete: _complete, ...quick } = quickPlan(request, now)
  void _complete

  // A bare title goes to the title search, without spending a model call.
  if (!rawHasFacets(quick) && !looksLikeAsk(request) && wordCount(request) <= 6 && (await isExactTitle(request))) {
    countStat('titleChecks')
    const plan: RawPlan = { ...quick, intent: 'title', title: request, unmatched: [] }
    void writeMeaning(key, { plan, ai: false }, now)
    return decide(request, plan, false, 'title', false)
  }

  if (o.modelAllowed) {
    const answer = await askModels(request, o.guest, now)
    if (answer.plan) {
      countStat('model')
      void writeMeaning(key, { plan: answer.plan, ai: true }, now)
      return decide(request, answer.plan, true, 'model', false)
    }
  }

  // Simple matching: kept 10 minutes, so the model gets its turn back soon.
  countStat(['parser', 'resting'])
  const plan = sanitizeRawPlan(quick, request, now) ?? quick
  void writeMeaning(key, { plan, ai: false }, now)
  return decide(request, plan, false, 'parser', true)
}
