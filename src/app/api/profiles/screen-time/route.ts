// Screen time for the Kids profile in use (lib/screen-time): its settings and the minutes it has
// watched today (GET ?day=), and what a page has watched since its last report (POST). Grown-up
// profiles and Kids profiles without limits get {screen: null} and report nothing.
import { NextRequest, NextResponse } from 'next/server'
import { requireActiveProfile } from '@/src/lib/profiles'
import { isReportableDay } from '@/src/lib/screen-time'
import { addMinutes, minutesUsed } from '@/src/lib/screen-time-db'

export const dynamic = 'force-dynamic'
const PRIVATE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner.error
  const { profile } = owner
  const screen = profile.kids ? profile.screenTime ?? null : null
  if (!screen) return NextResponse.json({ screen: null, used: 0 }, { headers: PRIVATE })
  const day = request.nextUrl.searchParams.get('day')
  if (!isReportableDay(day)) return NextResponse.json({ error: 'Invalid day' }, { status: 400 })
  return NextResponse.json({ screen, used: await minutesUsed(profile.id, day) }, { headers: PRIVATE })
}

export async function POST(request: NextRequest) {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner.error
  const { userId, profile } = owner
  if (!profile.kids || !profile.screenTime) return NextResponse.json({ used: 0 }, { headers: PRIVATE })
  const body = await request.json().catch(() => null)
  const minutes = Number(body?.minutes)
  if (!isReportableDay(body?.day) || !Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 })
  }
  return NextResponse.json({ used: await addMinutes(userId, profile.id, body.day, minutes) }, { headers: PRIVATE })
}
