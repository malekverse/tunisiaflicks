// Starts a watch party (lib/party): { media, title } → { code, hostToken }. A signed-in grown-up
// profile only; one open party per account (a new one replaces it).
import { NextResponse } from 'next/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { createParty } from '@/src/lib/party'
import { cleanPartyMedia } from '@/src/lib/party-rules'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  const active = await getActiveProfile()
  if (!active?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  if (await getKidsMode()) return NextResponse.json({ error: 'grown_up_only' }, { status: 403, headers: noStore })
  const limit = await rateLimit(`party-create:${active.userId}`, 20, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const body = await request.json().catch(() => null)
  const media = cleanPartyMedia(body?.media)
  if (!media) return NextResponse.json({ error: 'bad_media' }, { status: 400, headers: noStore })
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const party = await createParty(active.userId, active.profile.name, media, title)
  return NextResponse.json(party, { headers: noStore })
}
