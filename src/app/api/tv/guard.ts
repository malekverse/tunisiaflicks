// The gate of the phone side of TV pairing (lookup and approve): a signed-in grown-up on a full
// session, within the rate limits. In order: 401 guest, 403 tv_session (a TV can't approve a TV),
// 409 needs_pick (no profile chosen on this phone), 403 kids, 429.
import { NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/src/lib/auth'
import { getActiveProfile, type ActiveProfile } from '@/src/lib/profiles'
import { isLimitedSession } from '@/src/lib/session-scope'
import { clientIp, rateLimitAll, tooManyRequests } from '@/src/lib/rate-limit'

export const json = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function phoneGate(request: Request, action: 'lookup' | 'approve'): Promise<
  { error: NextResponse } | { session: Session; active: ActiveProfile & { profile: NonNullable<ActiveProfile['profile']> } }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: json(401, 'signed_out', 'Sign in to approve a TV') }
  if (isLimitedSession(session)) return { error: json(403, 'tv_session', 'Not available on a TV signed in with a code') }
  const active = await getActiveProfile()
  if (!active) return { error: json(401, 'signed_out', 'Sign in to approve a TV') }
  if (!active.profile) return { error: json(409, 'needs_pick', 'Choose a profile first') }
  if (active.profile.kids) return { error: json(403, 'kids', 'Switch to a grown-up profile to sign in a TV') }

  const limit = await rateLimitAll([
    [`tv-${action}:user:${session.user.id}`, 10, 10 * 60],
    [`tv-${action}:ip:${clientIp(request.headers)}`, 20, 10 * 60],
  ])
  if (!limit.ok) return { error: tooManyRequests(limit.retryAfter) }
  return { session, active: active as ActiveProfile & { profile: NonNullable<ActiveProfile['profile']> } }
}
