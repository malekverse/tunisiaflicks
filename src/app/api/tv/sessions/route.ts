// The account's TVs signed in with a code (Settings #security, "TVs signed in").
// GET → {sessions: [{id, deviceLabel, profileId, profileName, createdAt, lastSeenAt}], canRevoke}.
// DELETE ?id= signs one out (it notices within 5 minutes, see src/lib/auth.ts).
// Never for a TV session itself (403 tv_session); signing out needs a grown-up profile (403 kids).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/lib/auth'
import { getActiveProfile } from '@/src/lib/profiles'
import { isLimitedSession } from '@/src/lib/session-scope'
import { listTvSessions, revokeTvSession } from '@/src/lib/tv-sessions'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }
const error = (status: number, code: string, message: string) => NextResponse.json({ error: message, code }, { status, headers: noStore })

async function gate() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { response: error(401, 'signed_out', 'Unauthorized') }
  if (isLimitedSession(session)) return { response: error(403, 'tv_session', 'Not available on a TV signed in with a code') }
  const active = await getActiveProfile()
  if (!active) return { response: error(401, 'signed_out', 'Unauthorized') }
  return { active }
}

export async function GET() {
  const result = await gate()
  if ('response' in result) return result.response
  const { active } = result
  const names = new Map(active.profiles.map((profile) => [profile.id, profile.name]))
  const sessions = (await listTvSessions(active.userId)).map((item) => ({ ...item, profileName: names.get(item.profileId) ?? null }))
  return NextResponse.json({ sessions, canRevoke: !active.profile?.kids && !!active.profile }, { headers: noStore })
}

export async function DELETE(request: NextRequest) {
  const result = await gate()
  if ('response' in result) return result.response
  const { active } = result
  if (!active.profile || active.profile.kids) return error(403, 'kids', 'Switch to a grown-up profile to sign a TV out')

  const id = request.nextUrl.searchParams.get('id') ?? ''
  const done = await revokeTvSession(active.userId, id)
  if (!done) return error(404, 'not_found', 'No such TV')
  return NextResponse.json({ ok: true }, { headers: noStore })
}
