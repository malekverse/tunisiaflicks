// Request rate limiting backed by MongoDB, so the counters are shared by every serverless instance
// (an in-memory limiter would reset on each cold start). Fixed windows: one document per
// key+window, removed automatically by a TTL index once the window is over.
import { NextResponse } from 'next/server'
import clientPromise from '@/src/lib/mongodb'

export type RateLimitResult = { ok: boolean, remaining: number, retryAfter: number }

/** The message every throttled endpoint answers with (translated client-side, see lib/i18n). */
export const TOO_MANY_ATTEMPTS = 'Too many attempts. Please try again later.'

let indexReady: Promise<unknown> | null = null

async function collection() {
  const db = (await clientPromise).db()
  const limits = db.collection<{ _id: string, count: number, expiresAt: Date }>('rateLimits')
  indexReady ??= limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
    indexReady = null
    console.error('rateLimits TTL index:', error)
  })
  await indexReady
  return limits
}

/**
 * Counts one hit for `key` and says whether it is still within `limit` hits per `windowSeconds`.
 * Fails open (allows the request) if the database is unreachable: a broken limiter must never lock
 * everybody out of logging in.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - (now % windowSeconds)
  const windowEnd = windowStart + windowSeconds
  try {
    const limits = await collection()
    // mongodb v5 driver: the updated document is in `.value`.
    const result = await limits.findOneAndUpdate(
      { _id: `${key}:${windowStart}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowEnd * 1000) } },
      { upsert: true, returnDocument: 'after' }
    )
    const count = result.value?.count ?? 1
    return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfter: windowEnd - now }
  } catch (error) {
    console.error('Rate limiter unavailable, allowing request:', error)
    return { ok: true, remaining: limit, retryAfter: 0 }
  }
}

/** Checks several limits at once (e.g. per IP and per account); blocked if any of them is. */
export async function rateLimitAll(checks: [key: string, limit: number, windowSeconds: number][]) {
  const results = await Promise.all(checks.map(([key, limit, windowSeconds]) => rateLimit(key, limit, windowSeconds)))
  const blocked = results.filter((result) => !result.ok)
  return blocked.length
    ? { ok: false, retryAfter: Math.max(...blocked.map((result) => result.retryAfter)) }
    : { ok: true, retryAfter: 0 }
}

/** Best-effort client IP behind Vercel's proxy (first hop of x-forwarded-for). */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const get = (name: string) => {
    if (headers instanceof Headers) return headers.get(name)
    const value = headers[name]
    return Array.isArray(value) ? value[0] : value
  }
  return get('x-forwarded-for')?.split(',')[0]?.trim() || get('x-real-ip') || 'unknown'
}

/** Standard 429 answer with a Retry-After header. */
export function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { message: TOO_MANY_ATTEMPTS, retryAfter },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } }
  )
}

/** Normalised email for rate-limit keys and lookups. */
export const normalizeEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '')
