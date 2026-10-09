// The phone's answer for a TV: POST {code, approve, profileId}.
// Same gate as the lookup (../../guard.ts). Approving also needs a sign-in on this phone within the
// last 10 minutes (403 {code:'reauth'} otherwise), and a profile of this account (Kids allowed: the
// TV is then pinned to it). pending → approved happens in one atomic update. Declining burns the
// code and needs no fresh sign-in (saying no is always safe).
import { NextRequest, NextResponse } from 'next/server'
import { isProfileId } from '@/src/lib/models/Profile'
import { isFreshLogin } from '@/src/lib/session-scope'
import { answerPairing, normalizeUserCode } from '@/src/lib/tv-pairing'
import { json, phoneGate } from '../../guard'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json(415, 'json', 'Send JSON')
  }
  const gate = await phoneGate(request, 'approve')
  if ('error' in gate) return gate.error
  const { session, active } = gate

  const body = await request.json().catch(() => null)
  const code = normalizeUserCode(body?.code)
  if (!code || typeof body?.approve !== 'boolean') return json(400, 'bad_request', 'Send {code, approve, profileId}')

  if (!body.approve) {
    const done = await answerPairing(code, { approve: false })
    return done
      ? NextResponse.json({ status: 'denied' }, { headers: { 'Cache-Control': 'no-store' } })
      : json(404, 'not_found', 'No TV is waiting with this code')
  }

  if (!isFreshLogin(session)) return json(403, 'reauth', 'Sign in again on this phone to approve a TV')
  const profile = isProfileId(body.profileId) ? active.profiles.find((item) => item.id === body.profileId) : undefined
  if (!profile) return json(403, 'profile', 'This profile does not belong to your account')

  const done = await answerPairing(code, { approve: true, userId: active.userId, profileId: profile.id })
  if (!done) return json(404, 'not_found', 'No TV is waiting with this code')
  return NextResponse.json({ status: 'approved', profile: { id: profile.id, name: profile.name } }, { headers: { 'Cache-Control': 'no-store' } })
}
