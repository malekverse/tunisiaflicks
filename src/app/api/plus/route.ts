// TunisiaFlicks+ for the signed-in account (lib/plus): GET the state (and the invite link and how
// it's going; ?light=1: only what the shell needs), PUT the perks' settings (the accent, the badge).
import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { getPlus, inviteProgress, setPlusPrefs } from '@/src/lib/plus'
import { ACCENT_COOKIE, daysLeft, isAccent, towardsNext } from '@/src/lib/plus-rules'
import { linkBase } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

async function userId() {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

export async function GET(request: NextRequest) {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const plus = await getPlus(id)
  const state = { active: plus.active, accent: plus.accent }
  if (request.nextUrl.searchParams.get('light')) return NextResponse.json(state, { headers: noStore })
  const invite = await inviteProgress(id)
  return NextResponse.json({
    ...state,
    until: plus.until,
    daysLeft: daysLeft(plus.until),
    showBadge: plus.showBadge,
    membership: plus.membership,
    invite: {
      link: invite.code ? `${linkBase()}/?ref=${invite.code}` : null,
      friends: invite.friends,
      waiting: invite.waiting,
      months: invite.months,
      towardsNext: towardsNext(invite.friends),
    },
  }, { headers: noStore })
}

/** Body: { accent?, showBadge? }. Only while Plus is on. */
export async function PUT(request: Request) {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const plus = await getPlus(id)
  if (!plus.active) return NextResponse.json({ error: 'plus_required' }, { status: 403, headers: noStore })
  const body = await request.json().catch(() => null)
  const accent = isAccent(body?.accent) ? body.accent : undefined
  const showBadge = typeof body?.showBadge === 'boolean' ? body.showBadge : undefined
  await setPlusPrefs(id, { accent, showBadge })
  const response = NextResponse.json({ ok: true }, { headers: noStore })
  // The accent rides in a plain cookie: the layout paints it with no database read (PlusSync
  // clears it once Plus ends).
  if (accent) response.cookies.set(ACCENT_COOKIE, accent, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' })
  return response
}
