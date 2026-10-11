// How the apps' API answers: cached at the edge, plain error codes, and a per-IP limit (server only:
// the limit is kept in the database).
import { NextResponse } from 'next/server'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { HOUR } from './shared'

/** A JSON answer the CDN may keep for `maxAge` seconds (and serve stale for a week while it refreshes). */
export function cached(body: unknown, maxAge: number) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': `public, max-age=${Math.min(maxAge, 600)}, s-maxage=${maxAge}, stale-while-revalidate=${7 * 24 * HOUR}` },
  })
}

export const failure = (code: string, status: number) => NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } })

/** Per-IP limit for the requests the CDN doesn't absorb; null when the request may go on. */
export async function limited(request: Request, bucket: string, max = 240) {
  const limit = await rateLimit(`app-api:${bucket}:${clientIp(request.headers)}`, max, 600)
  return limit.ok ? null : tooManyRequests(limit.retryAfter)
}
