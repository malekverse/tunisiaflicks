// "Wrong album?": POST /api/soundtrack/report {type, id, albumId}
// One report per address and title (counted as a hash, never stored as is). Three different
// people reporting the same album block it for that title, and the next visit searches again.
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/src/lib/rate-limit'
import { reportSoundtrack } from '@/src/lib/soundtrack'

export const dynamic = 'force-dynamic'

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const type = body?.type
  const id = typeof body?.id === 'number' ? String(body.id) : body?.id
  const albumId = body?.albumId
  if (type !== 'movie' && type !== 'tv') return reply(400, { code: 'invalid_type' })
  if (typeof id !== 'string' || !/^[0-9]{1,9}$/.test(id)) return reply(400, { code: 'invalid_id' })
  if (typeof albumId !== 'number' || !Number.isSafeInteger(albumId) || albumId <= 0) return reply(400, { code: 'invalid_album' })

  const tmdbId = String(Number(id))
  const reporter = createHash('sha256').update(`soundtrack-report:${clientIp(request.headers)}`).digest('hex').slice(0, 32)
  // One per address and title, for a month.
  const once = await rateLimit(`soundtrack-report:${reporter}:${type}:${tmdbId}`, 1, 30 * 86400)
  if (!once.ok) return reply(429, { code: 'already_reported' })

  try {
    const result = await reportSoundtrack(type, tmdbId, albumId, reporter)
    if (!result.ok) return reply(409, { code: 'album_changed' })
    return reply(200, { ok: true, blocked: result.blocked })
  } catch (error) {
    console.error('soundtrack report:', error)
    return reply(503, { code: 'unavailable' })
  }
}
