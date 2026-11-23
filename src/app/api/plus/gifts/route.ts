// Gifts of TunisiaFlicks+ the signed-in grown-up made (lib/plus-gifts): GET the list, POST a new
// one ({ fromName? }), which waits for its Ko-fi payment. Never from a Kids profile.
import { NextResponse } from 'next/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { createGift, listGifts } from '@/src/lib/plus-gifts'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { linkBase } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

async function grownUp(): Promise<string | NextResponse> {
  const active = await getActiveProfile()
  if (!active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  if (await getKidsMode()) return NextResponse.json({ error: 'grown_up_only' }, { status: 403, headers: noStore })
  return active.userId
}

export async function GET() {
  const user = await grownUp()
  if (typeof user !== 'string') return user
  return NextResponse.json({ gifts: await listGifts(user, linkBase()) }, { headers: noStore })
}

export async function POST(request: Request) {
  const user = await grownUp()
  if (typeof user !== 'string') return user
  const limit = await rateLimit(`plus-gift:${user}`, 10, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const body = await request.json().catch(() => null)
  const result = await createGift(user, body?.fromName, linkBase())
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409, headers: noStore })
  return NextResponse.json({ gift: result.gift }, { status: 201, headers: noStore })
}
