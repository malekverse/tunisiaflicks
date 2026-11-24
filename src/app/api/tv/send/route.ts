// "Play on my TV" (lib/tv-send): POST {tv, media, title} from a phone or a computer leaves the title
// for one of the account's TVs signed in with a code. Never from a TV session itself.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/lib/auth'
import { getActiveProfile } from '@/src/lib/profiles'
import { isLimitedSession } from '@/src/lib/session-scope'
import { isTvSessionId, listTvSessions } from '@/src/lib/tv-sessions'
import { cleanSentMedia, sendToTv } from '@/src/lib/tv-send'
import { cleanText } from '@/src/lib/lists-db'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store' }

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  if (isLimitedSession(session)) return NextResponse.json({ error: 'Not from a TV', code: 'tv_session' }, { status: 403, headers: noStore })
  const active = await getActiveProfile()
  if (!active?.profile) return NextResponse.json({ error: 'No profile selected' }, { status: 409, headers: noStore })

  const body = await request.json().catch(() => null)
  const media = cleanSentMedia(body?.media)
  const title = cleanText(body?.title, 200)
  if (!media || !title || !isTvSessionId(body?.tv)) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore })
  // Only to a TV of this account that is still signed in.
  const tvs = await listTvSessions(active.userId)
  if (!tvs.some((tv) => tv.id === body.tv)) return NextResponse.json({ error: 'That TV isn’t signed in any more', code: 'no_tv' }, { status: 404, headers: noStore })
  await sendToTv(active.userId, body.tv, { media, title, fromName: active.profile.name })
  return NextResponse.json({ ok: true }, { headers: noStore })
}
