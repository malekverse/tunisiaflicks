// Limited sessions: a TV signed in with a code (scope 'tv') may watch and use its pinned profile,
// but may never change the account (email, password, profiles, deletion) or count as a fresh login.
import { NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/src/lib/auth'

export function isLimitedSession(s: Session | null): boolean {
  return s?.scope === 'tv'
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
