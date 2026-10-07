// Crowd-sourced stream source health (see lib/stream-health.ts).
import { NextResponse } from 'next/server'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { getSourceHealth, recordSourceReport } from '@/src/lib/stream-health'
import { PROVIDER_NAMES } from '@/src/lib/stream-providers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getSourceHealth(), {
      // Shared by everyone: let the CDN serve it for a few minutes.
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Stream health read failed:', error)
    return NextResponse.json({})
  }
}

/** Body: { name, ok }. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (typeof body?.name !== 'string' || !PROVIDER_NAMES.includes(body.name) || typeof body.ok !== 'boolean') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const ip = clientIp(request.headers)
  // One vote per source per viewer per hour, and a cap overall.
  const perSource = await rateLimit(`stream-health:${ip}:${body.name}`, 1, 60 * 60)
  const overall = await rateLimit(`stream-health:${ip}`, 20, 60 * 60)
  if (!perSource.ok || !overall.ok) return tooManyRequests(Math.max(perSource.retryAfter, overall.retryAfter))
  await recordSourceReport(body.name, body.ok)
  return NextResponse.json({ ok: true })
}
