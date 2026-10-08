// Who is acting socially: the signed-in account's active profile, its page (if any), and whether it
// may act at all. Every social API starts with requireSocial().
import 'server-only'
import { cache } from 'react'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { ObjectId } from 'mongodb'
import { authOptions } from '@/src/lib/auth'
import { getActiveProfile } from '@/src/lib/profiles'
import { isLimitedSession } from '@/src/lib/session-scope'
import { TOO_MANY_ATTEMPTS, rateLimitAll } from '@/src/lib/rate-limit'
import { socialDb, type SocialProfileDoc } from './db'
import type { ProfileRef } from './types'

export type { SocialProfileDoc }

/** JSON that is never cached anywhere (every social answer depends on who asks). */
export function socialJson(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', ...headers } })
}

/** The error shape of every social API: {error, code}. */
export const socialError = (status: number, code: string, error?: string, extra?: Record<string, unknown>) =>
  socialJson({ error: error ?? code, code, ...extra }, status)

type Account = { verified: boolean; image: string | null; ownerProfileId: string | null }

/** The account's verification, photo and owner profile (once per request). */
export const loadAccount = cache(async (userId: string): Promise<Account> => {
  if (!ObjectId.isValid(userId)) return { verified: false, image: null, ownerProfileId: null }
  const { users } = await socialDb()
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { emailVerified: 1, image: 1, profiles: { $slice: 1 } } },
  )
  return {
    verified: !!user?.emailVerified,
    image: typeof user?.image === 'string' && user.image ? user.image : null,
    ownerProfileId: user?.profiles?.[0]?.id ? String(user.profiles[0].id) : null,
  }
})

/** The profile's page document (once per request). */
export const loadSocialProfile = cache(async (profileId: string): Promise<SocialProfileDoc | null> => {
  const { profiles } = await socialDb()
  return profiles.findOne({ _id: profileId })
})

/**
 * The signed-in person as the social layer sees them, or null for guests and before a profile is
 * picked on this device. A page's colour follows its profile's colour (refreshed here, lazily).
 */
export const socialSelf = cache(async (): Promise<null | {
  ref: ProfileRef
  kids: boolean
  verified: boolean
  limited: boolean
  profileName: string
  color: string
  social: SocialProfileDoc | null
}> => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const active = await getActiveProfile()
  const profile = active?.profile
  if (!active || !profile) return null
  const [account, social] = await Promise.all([loadAccount(active.userId), loadSocialProfile(profile.id)])
  if (social && social.color !== profile.color) {
    social.color = profile.color
    const { profiles } = await socialDb()
    await profiles.updateOne({ _id: social._id }, { $set: { color: profile.color } }).catch(() => undefined)
  }
  return {
    ref: { userId: active.userId, profileId: profile.id },
    kids: profile.kids,
    verified: account.verified,
    limited: isLimitedSession(session),
    profileName: profile.name,
    color: profile.color,
    social,
  }
})

/**
 * The gate of every social API. In order: 401 guest, 403 tv_session (a TV signed in with a code),
 * 409 needs_pick (no profile picked on this device), 403 kids, then 403 unverified for writes and
 * 409 needs_handle when the route needs a page.
 */
export async function requireSocial(opts: { needsHandle?: boolean; write?: boolean } = {}): Promise<
  { ref: ProfileRef; social: SocialProfileDoc | null } | { error: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: socialError(401, 'unauthorized', 'Unauthorized') }
  if (isLimitedSession(session)) return { error: socialError(403, 'tv_session', 'Not available on a TV signed in with a code') }
  const self = await socialSelf()
  if (!self) return { error: socialError(409, 'needs_pick', 'Pick a profile first') }
  if (self.kids) return { error: socialError(403, 'kids', 'Not available on Kids profiles') }
  if (opts.write && !self.verified) return { error: socialError(403, 'unverified', 'Verify your email first') }
  if (opts.needsHandle && !self.social) return { error: socialError(409, 'needs_handle', 'Create your page first') }
  return { ref: self.ref, social: self.social }
}

/** Rate limits (key, limit, window in seconds), all at once: the 429 to answer, or null. */
export async function socialRateLimit(checks: [key: string, limit: number, windowSeconds: number][]): Promise<NextResponse | null> {
  const result = await rateLimitAll(checks)
  if (result.ok) return null
  return socialJson(
    { error: TOO_MANY_ATTEMPTS, code: 'rate_limited', retryAfter: result.retryAfter },
    429,
    { 'Retry-After': String(Math.max(1, result.retryAfter)) },
  )
}

/** Reads a JSON body without throwing (null when it isn't an object). */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
}
