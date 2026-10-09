// Ask's three collections:
// - aiSearchCache: what a request meant ({_id: hash of the normalized request}); 14 days for the
//   model's answers, 10 minutes for the simple parser's (so the model gets its turn back soon).
//   Holds no account, no IP, and not the request itself (only its hash).
// - aiState: the daily model budget, what Groq last said about each model's limits, and the rate
//   limit windows (limits.ts). Everything expires on its own (TTL on expiresAt).
// - aiStats: daily counters for the owner (90 days), never any request text.
// Mongo 5.9 driver: findOneAndUpdate resolves to {value}.
import 'server-only'
import { createHash } from 'node:crypto'
import clientPromise from '@/src/lib/mongodb'
import { GUEST_SHARE, PROMPT_VERSION, dailyCalls } from './config'
import type { RawPlan } from './types'

export type CachedMeaning = { plan: RawPlan, ai: boolean }

type CacheDoc = { _id: string, plan: RawPlan, ai: boolean, v: string, createdAt: Date, expiresAt: Date }
export type StateDoc = {
  _id: string
  expiresAt: Date
  calls?: number
  guestCalls?: number
  tokens?: number
  count?: number
  remainingTokens?: number
  remainingRequests?: number
  tokensResetAt?: Date
  requestsResetAt?: Date
  blockedUntil?: Date
}
type StatsDoc = { _id: string, expiresAt: Date } & Record<string, unknown>

const DAY = 24 * 60 * 60 * 1000
export const MODEL_TTL_MS = 14 * DAY
export const PARSER_TTL_MS = 10 * 60 * 1000

let indexes: Promise<unknown> | null = null

/** The collections (their TTL indexes are made once per process). */
export async function aiDb() {
  const db = (await clientPromise).db()
  const cache = db.collection<CacheDoc>('aiSearchCache')
  const state = db.collection<StateDoc>('aiState')
  const stats = db.collection<StatsDoc>('aiStats')
  indexes ??= Promise.all([
    cache.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    state.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    stats.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    indexes = null
    console.error('ai-search indexes:', error)
  })
  await indexes
  return { cache, state, stats }
}

/** The cache key of a request: prompt version, year (the plan can say "recent") and the normalized words. */
export function cacheKey(normalized: string, now = new Date()): string {
  return createHash('sha256').update(`${PROMPT_VERSION}|${now.getUTCFullYear()}|${normalized}`).digest('hex')
}

/** A short one-way id for limit keys (no raw account id, cookie or IP is ever stored). */
export function hashId(value: string): string {
  return createHash('sha256').update(`ai-limit|${value}`).digest('hex').slice(0, 24)
}

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10)

/** What a request meant, if known and still fresh. Null on a miss or a database error. */
export async function readMeaning(key: string): Promise<CachedMeaning | null> {
  try {
    const { cache } = await aiDb()
    const doc = await cache.findOne({ _id: key, v: PROMPT_VERSION, expiresAt: { $gt: new Date() } })
    return doc ? { plan: doc.plan, ai: doc.ai } : null
  } catch (error) {
    console.error('aiSearchCache read:', error)
    return null
  }
}

/** Remembers what a request meant: 14 days for the model's answer, 10 minutes for the parser's. */
export async function writeMeaning(key: string, meaning: CachedMeaning, now = new Date()): Promise<void> {
  try {
    const { cache } = await aiDb()
    const expiresAt = new Date(now.getTime() + (meaning.ai ? MODEL_TTL_MS : PARSER_TTL_MS))
    await cache.updateOne(
      { _id: key },
      { $set: { plan: meaning.plan, ai: meaning.ai, v: PROMPT_VERSION, createdAt: now, expiresAt } },
      { upsert: true },
    )
  } catch (error) {
    console.error('aiSearchCache write:', error)
  }
}

export type BudgetResult = 'ok' | 'exhausted' | 'error'

/**
 * Takes one model call from today's budget, atomically, before the call is made: an updateOne on
 * {_id: 'budget:YYYY-MM-DD'} that only matches while calls < AI_DAILY_CALLS (and, for guests,
 * guestCalls < 40% of it), with upsert. When the day's document is full the filter misses and the
 * upsert collides with it (duplicate key): the budget is spent. Any other database error fails
 * closed ('error': no model call).
 */
export async function reserveBudget(guest: boolean, now = new Date()): Promise<BudgetResult> {
  const max = dailyCalls()
  const filter: Record<string, unknown> = { _id: `budget:${utcDay(now)}`, calls: { $lt: max } }
  if (guest) filter.guestCalls = { $lt: Math.floor(max * GUEST_SHARE) }
  const expiresAt = new Date(now.getTime() + 2 * DAY)
  const update = guest
    ? { $inc: { calls: 1, guestCalls: 1 }, $setOnInsert: { tokens: 0, expiresAt } }
    : { $inc: { calls: 1 }, $setOnInsert: { tokens: 0, guestCalls: 0, expiresAt } }
  // Two first calls of the day can both try to create the document: the loser retries once, and
  // only a second collision means the budget is really spent.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { state } = await aiDb()
      const result = await state.updateOne(filter as any, update as any, { upsert: true })
      return result.modifiedCount === 1 || result.upsertedCount === 1 ? 'ok' : 'exhausted'
    } catch (error: any) {
      if (error?.code !== 11000) {
        console.error('ai budget:', error)
        return 'error'
      }
    }
  }
  return 'exhausted'
}

/** Adds a call's tokens to today's budget document (after the call). */
export async function addTokens(tokens: number, now = new Date()): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return
  try {
    const { state } = await aiDb()
    await state.updateOne({ _id: `budget:${utcDay(now)}` }, { $inc: { tokens: Math.round(tokens) } })
  } catch (error) {
    console.error('ai budget tokens:', error)
  }
}

/** What Groq last said about these models' limits (one read for all of them). */
export async function readModelStates(ids: string[]): Promise<Map<string, StateDoc>> {
  const { state } = await aiDb()
  const docs = await state.find({ _id: { $in: ids.map((id) => `model:${id}`) } }).toArray()
  return new Map(docs.map((doc) => [doc._id.slice('model:'.length), doc]))
}

/** Records a model's remaining limits (from Groq's x-ratelimit headers) or a block after a 429. */
export async function writeModelState(id: string, fields: Partial<Omit<StateDoc, '_id'>>, now = new Date()): Promise<void> {
  try {
    const { state } = await aiDb()
    await state.updateOne({ _id: `model:${id}` }, { $set: { ...fields, expiresAt: new Date(now.getTime() + 2 * DAY) } }, { upsert: true })
  } catch (error) {
    console.error('ai model state:', error)
  }
}

export type StatName = 'asks' | 'plans' | 'cache' | 'model' | 'parser' | 'resting' | 'switches' | 'titleChecks' | 'limited' | 'errors' | 'modelFailures' | 'budgetSpent'

/** Counts events for today (aiStats, 90 days). Never blocks or fails a request. */
export function countStat(names: StatName | StatName[], now = new Date()): void {
  const list = Array.isArray(names) ? names : [names]
  if (!list.length) return
  aiDb()
    .then(({ stats }) => stats.updateOne(
      { _id: utcDay(now) },
      { $inc: Object.fromEntries(list.map((name) => [name, 1])), $setOnInsert: { expiresAt: new Date(now.getTime() + 90 * DAY) } },
      { upsert: true },
    ))
    .catch(() => undefined)
}
