// Crowd-sourced stream source health (see lib/stream-health.ts).
import { NextResponse, type NextRequest } from 'next/server'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { getSourceHealth, getTitleHealth, recordSourceReport, recordTitleReport } from '@/src/lib/stream-health'
import { PROVIDER_NAMES } from '@/src/lib/stream-providers'
import { isTitleKey } from '@/src/lib/source-rank'

export const dynamic = 'force-dynamic'

/** Every source overall, or with ?title=movie:550 what viewers reported for that title. */
export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')
  try {
    if (title !== null) {
      if (!isTitleKey(title)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
      return NextResponse.json(await getTitleHealth(title, PROVIDER_NAMES), {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    }
    return NextResponse.json(await getSourceHealth(), {
      // Shared by everyone: let the CDN serve it for a few minutes.
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Stream health read failed:', error)
    return NextResponse.json({})
  }
}

/** Body: { name, ok, title? } (title: "movie:550", "tv:1399"). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (typeof body?.name !== 'string' || !PROVIDER_NAMES.includes(body.name) || typeof body.ok !== 'boolean') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const title = isTitleKey(body.title) ? body.title : null
  const ip = clientIp(request.headers)
  // One vote per source per title per viewer per hour, and a cap overall.
  const perSource = await rateLimit(`stream-health:${ip}:${body.name}:${title ?? '*'}`, 1, 60 * 60)
  const overall = await rateLimit(`stream-health:${ip}`, 30, 60 * 60)
  if (!perSource.ok || !overall.ok) return tooManyRequests(Math.max(perSource.retryAfter, overall.retryAfter))
  // The overall health counts a source once an hour per viewer, whatever the title.
  const overallVote = await rateLimit(`stream-health:${ip}:${body.name}`, 1, 60 * 60)
  await Promise.all([
    overallVote.ok ? recordSourceReport(body.name, body.ok) : null,
    title ? recordTitleReport(title, body.name, body.ok) : null,
  ])
  return NextResponse.json({ ok: true })
}
