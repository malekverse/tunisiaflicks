// Family Plus for the signed-in account (lib/plus-family). GET: the family as it sees it (holder:
// the link and who joined; member: whose family). POST { action: 'join', token } joins one;
// POST { action: 'newLink' } retires the holder's link for a new one. DELETE ?member=<id>: the
// holder removes someone; DELETE alone: the account leaves its family. Grown-up profiles only.
import { NextResponse, type NextRequest } from 'next/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { familyState, joinFamily, leaveFamily, newFamilyLink, removeFromFamily } from '@/src/lib/plus-family'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { linkBase } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }

async function grownUp(): Promise<{ userId: string } | NextResponse> {
  const active = await getActiveProfile()
  if (!active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  if (await getKidsMode()) return NextResponse.json({ error: 'grown_up_only' }, { status: 403, headers: noStore })
  return { userId: active.userId }
}

export async function GET() {
  const who = await grownUp()
  if (who instanceof NextResponse) return who
  return NextResponse.json(await familyState(who.userId, linkBase()), { headers: noStore })
}

export async function POST(request: Request) {
  const who = await grownUp()
  if (who instanceof NextResponse) return who
  const limit = await rateLimit(`plus-family:${who.userId}`, 20, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const body = await request.json().catch(() => null)
  if (body?.action === 'join') {
    const result = await joinFamily(who.userId, String(body.token ?? ''))
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 409, headers: noStore })
    return NextResponse.json({ until: result.until.toISOString() }, { headers: noStore })
  }
  if (body?.action === 'newLink') {
    const link = await newFamilyLink(who.userId, linkBase())
    if (!link) return NextResponse.json({ error: 'no_family' }, { status: 409, headers: noStore })
    return NextResponse.json({ link }, { headers: noStore })
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: noStore })
}

export async function DELETE(request: NextRequest) {
  const who = await grownUp()
  if (who instanceof NextResponse) return who
  const member = request.nextUrl.searchParams.get('member')
  const ok = member ? await removeFromFamily(who.userId, member.slice(0, 40)) : await leaveFamily(who.userId)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: noStore })
}
