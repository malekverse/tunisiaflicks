// A friend redeems a gift of TunisiaFlicks+ by its link's secret (lib/plus-gifts): { token } →
// { months, until } or { error: not_found | unpaid | used }. A grown-up profile only.
import { NextResponse } from 'next/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { redeemGift } from '@/src/lib/plus-gifts'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  const active = await getActiveProfile()
  if (!active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  if (await getKidsMode()) return NextResponse.json({ error: 'grown_up_only' }, { status: 403, headers: noStore })
  const limit = await rateLimit(`plus-gift-redeem:${active.userId}`, 10, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const body = await request.json().catch(() => null)
  const result = await redeemGift(active.userId, String(body?.token ?? ''))
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 409, headers: noStore })
  return NextResponse.json({ months: result.months, until: result.until.toISOString() }, { headers: noStore })
}
