// Cancel a gift of TunisiaFlicks+ that isn't paid yet (lib/plus-gifts).
import { NextResponse } from 'next/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { cancelGift } from '@/src/lib/plus-gifts'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, { params }: { params: { code: string } }) {
  const active = await getActiveProfile()
  if (!active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await getKidsMode()) return NextResponse.json({ error: 'grown_up_only' }, { status: 403 })
  const cancelled = await cancelGift(active.userId, decodeURIComponent(params.code))
  return NextResponse.json({ ok: cancelled }, { status: cancelled ? 200 : 404, headers: { 'Cache-Control': 'private, no-store' } })
}
