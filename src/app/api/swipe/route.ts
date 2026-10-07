// Create a "Swipe to decide" room (see lib/swipe.ts). Guests welcome.
import { NextResponse } from 'next/server'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { cleanName, createRoom, type SwipeKind } from '@/src/lib/swipe'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const limit = await rateLimit(`swipe-create:ip:${clientIp(request.headers)}`, 10, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const body = await request.json().catch(() => null)
  const name = cleanName(body?.name)
  if (!name) return NextResponse.json({ error: 'name' }, { status: 400 })
  const kind: SwipeKind = body?.kind === 'tv' || body?.kind === 'both' ? body.kind : 'movie'
  const genre = Number.isInteger(body?.genre) && body.genre > 0 ? body.genre : null

  const room = await createRoom({ kind, genre, kids: await getKidsMode(), locale: getLocale(), name })
  if (!room) return NextResponse.json({ error: 'failed' }, { status: 502 })
  return NextResponse.json(room)
}
