// POST /api/badges/seen { id }: the owner opened a badge on their shelf, so its dot goes away until
// the next level. 200 { ok }, 400 for an unknown badge, 401 guest, 403/409 for profile problems.
import { NextResponse } from 'next/server'
import { requireActiveProfile } from '@/src/lib/profiles'
import { isBadgeId } from '@/src/lib/badges/catalogue'
import { markSeen } from '@/src/lib/badges/view'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner.error
  const body = await request.json().catch(() => null)
  const id = body && typeof body === 'object' ? (body as { id?: unknown }).id : undefined
  if (!isBadgeId(id)) return NextResponse.json({ error: 'Unknown badge' }, { status: 400 })
  try {
    const ok = await markSeen({ userId: owner.userId, profileId: owner.profile.id }, id)
    return NextResponse.json({ ok }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('badges/seen failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
