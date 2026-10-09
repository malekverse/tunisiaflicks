// Limited sessions: a TV signed in with a code (scope 'tv') may watch and use its pinned profile,
// but may never change the account (email, password, profiles, deletion) or count as a fresh login.
import { NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/src/lib/auth'

export function isLimitedSession(s: Session | null): boolean {
  return s?.scope === 'tv'
}

/** How recent a sign-in must be for sensitive changes without a password (and to pick a profile freely). */
export const FRESH_LOGIN_MS = 10 * 60 * 1000

/** Signed in (credentials typed, or Google) within the last 10 minutes. A TV session never counts. */
export function isFreshLogin(s: Session | null, now = Date.now()): boolean {
  return !!s && !isLimitedSession(s) && typeof s.loginAt === 'number' && now - s.loginAt < FRESH_LOGIN_MS
}

/**
 * For mutating route handlers, called first: the 403 to return when the session is a limited (TV)
 * one, otherwise null.
 *
 *   const denied = await denyLimitedSession()
 *   if (denied) return denied
 */
export async function denyLimitedSession(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions)
  if (!isLimitedSession(session)) return null
  return NextResponse.json({ error: 'Not available on a TV signed in with a code', code: 'tv_session' }, { status: 403 })
}
