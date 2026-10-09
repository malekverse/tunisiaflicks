// Ask's rate limits. Unlike src/lib/rate-limit.ts (which lets requests through when the database
// is down, so nobody is locked out of signing in), these FAIL CLOSED: when they can't be counted,
// no model is called and Ask answers with the simple parser.
//
// - Guests: per first-party cookie id (tf-gid, set by the route), 6 a minute and 30 a day, with a
//   backstop per IP (an IPv6 /64 counts as one), 60 a minute and 300 a day.
// - Signed in: per account, 10 a minute and 80 a day.
// - ai-run: 40 runs a minute for the whole site; ai:global: 6 calls a minute per model.
// Requests that only replay a plan (a chip removed, Show more, a shared p= link) never reach the
// model: they count three times more loosely per minute and not at all per day.
// Keys are hashed (hashId): no account id, cookie or IP is stored.
import 'server-only'
import { aiDb, hashId } from './cache'
import { ipKey } from './net'

export { ipKey }

export type Asker = { userId: string | null, guestId: string | null, ip: string }

export type LimitCheck =
  | { ok: true, modelAllowed: boolean }
  | { ok: false, code: 'rate_minute' | 'rate_day' | 'busy', retryAfter: number, signIn: boolean }

export const LIMITS = {
  run: 40,
  user: { minute: 10, day: 80 },
  guest: { minute: 6, day: 30 },
  ip: { minute: 60, day: 300 },
  /** Plan-only requests: this many times the per-minute limit. */
  replayFactor: 3,
  /** Calls a minute to one model, site-wide. */
  modelPerMinute: 6,
} as const

const MINUTE = 60
const DAY = 86400

type Count = { ok: boolean, retryAfter: number }

/** Counts one hit in a fixed window (UTC-aligned); throws when the database can't be reached. */
async function hit(key: string, limit: number, windowSeconds: number, now: number): Promise<Count> {
  const seconds = Math.floor(now / 1000)
  const start = seconds - (seconds % windowSeconds)
  const end = start + windowSeconds
  const { state } = await aiDb()
  const result = await state.findOneAndUpdate(
    { _id: `rl:${key}:${start}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(end * 1000) } },
    { upsert: true, returnDocument: 'after' },
  )
  const count = result.value?.count ?? 1
  return { ok: count <= limit, retryAfter: Math.max(1, end - seconds) }
}

/**
 * Counts this request against every limit that applies. `interpret`: a request that may reach the
 * model (a new question); otherwise a replay of a plan. A database error lets the request through
 * WITHOUT the model (modelAllowed false).
 */
export async function checkAskLimits(who: Asker, o: { interpret: boolean }, now = Date.now()): Promise<LimitCheck> {
  const factor = o.interpret ? 1 : LIMITS.replayFactor
  type Window = { key: string, limit: number, seconds: number, code: 'rate_minute' | 'rate_day' | 'busy' }
  const windows: Window[] = [{ key: 'ai-run', limit: LIMITS.run * factor, seconds: MINUTE, code: 'busy' }]
  if (who.userId) {
    const id = hashId(`u:${who.userId}`)
    windows.push({ key: `u:${id}:m`, limit: LIMITS.user.minute * factor, seconds: MINUTE, code: 'rate_minute' })
    if (o.interpret) windows.push({ key: `u:${id}:d`, limit: LIMITS.user.day, seconds: DAY, code: 'rate_day' })
  } else {
    const ip = hashId(`ip:${ipKey(who.ip)}`)
    windows.push({ key: `ip:${ip}:m`, limit: LIMITS.ip.minute * factor, seconds: MINUTE, code: 'rate_minute' })
    if (o.interpret) windows.push({ key: `ip:${ip}:d`, limit: LIMITS.ip.day, seconds: DAY, code: 'rate_day' })
    if (who.guestId) {
      const guest = hashId(`g:${who.guestId}`)
      windows.push({ key: `g:${guest}:m`, limit: LIMITS.guest.minute * factor, seconds: MINUTE, code: 'rate_minute' })
      if (o.interpret) windows.push({ key: `g:${guest}:d`, limit: LIMITS.guest.day, seconds: DAY, code: 'rate_day' })
    }
  }
  try {
    const counts = await Promise.all(windows.map((window) => hit(window.key, window.limit, window.seconds, now)))
    // The most telling refusal first: a day's limit, then a minute's, then the site being busy.
    for (const code of ['rate_day', 'rate_minute', 'busy'] as const) {
      const blocked = windows.map((window, index) => ({ window, count: counts[index] })).filter((entry) => entry.window.code === code && !entry.count.ok)
      if (blocked.length) {
        return { ok: false, code, retryAfter: Math.max(...blocked.map((entry) => entry.count.retryAfter)), signIn: !who.userId && code === 'rate_day' }
      }
    }
    return { ok: true, modelAllowed: true }
  } catch (error) {
    console.error('ai limits unavailable, no model call:', error)
    return { ok: true, modelAllowed: false }
  }
}

/** One of a model's calls this minute, site-wide (ai:global). False when full or uncountable. */
export async function takeModelSlot(model: string, now = Date.now()): Promise<boolean> {
  try {
    return (await hit(`ai-global:${model}`, LIMITS.modelPerMinute, MINUTE, now)).ok
  } catch {
    return false
  }
}
