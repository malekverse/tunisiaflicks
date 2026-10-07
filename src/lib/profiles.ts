// Server-side profile helpers: loading an account's profiles and resolving the active one from the
// profile cookie. The cookie is only a *choice* among the session user's own profiles: an id that
// isn't one of them is never used (API routes answer 403).
import { cache } from 'react'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { ObjectId } from 'mongodb'
import { authOptions } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { PROFILE_COLORS, PROFILE_COOKIE, cleanProfileName, type Profile, type ProfilesResponse } from '@/src/lib/models/Profile'

/** Right after signing in (password just typed) a grown-up profile can be picked without re-entering it. */
const FRESH_LOGIN_MS = 10 * 60 * 1000

const toProfile = (raw: any): Profile => ({
  id: String(raw.id),
  name: String(raw.name),
  color: PROFILE_COLORS.includes(raw.color) ? raw.color : PROFILE_COLORS[0],
  kids: raw.kids === true,
})

export function newProfile(name: string, color: string = PROFILE_COLORS[0], kids = false) {
  return { id: new ObjectId().toHexString(), name, color, kids, createdAt: new Date() }
}

/**
 * The account's profiles. Accounts that predate profiles (or were created since) get their default
 * profile here on first use, and their existing lists are adopted by it, so nothing is lost even if
 * scripts/migrate-profiles.mjs hasn't been run.
 */
export async function loadProfiles(userId: string): Promise<Profile[]> {
  if (!ObjectId.isValid(userId)) return []
  const _id = new ObjectId(userId)
  const db = (await clientPromise).db()
  const users = db.collection('users')

  const user = await users.findOne({ _id }, { projection: { profiles: 1, name: 1 } })
  if (!user) return []
  if (Array.isArray(user.profiles) && user.profiles.length > 0) return user.profiles.map(toProfile)

  // Only one concurrent request wins the insert; everyone then reads the winner's profile.
  const name = cleanProfileName(String(user.name ?? '').split(' ')[0]) ?? 'Me'
  await users.updateOne(
    { _id, $or: [{ profiles: { $exists: false } }, { profiles: { $size: 0 } }] },
    { $set: { profiles: [newProfile(name)] } }
  )
  const fresh = await users.findOne({ _id }, { projection: { profiles: 1 } })
  const profiles: Profile[] = (fresh?.profiles ?? []).map(toProfile)
  if (profiles.length > 0) {
    await db.collection('userContent').updateMany(
      { userId, profileId: { $exists: false } },
      { $set: { profileId: profiles[0].id } }
    )
  }
  return profiles
}

export type ActiveProfile = {
  userId: string
  profiles: Profile[]
  /** The profile in use: the cookie's, or the only profile when nothing is picked yet. */
  profile: Profile | null
  /** 'invalid' = the cookie names a profile this account doesn't have (deleted, or another account's). */
  cookie: 'valid' | 'missing' | 'invalid'
  loginAt?: number
}

/** The signed-in user's profiles and the active one (once per request). Null for guests. */
export const getActiveProfile = cache(async (): Promise<ActiveProfile | null> => {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return null

  const profiles = await loadProfiles(userId)
  const raw = cookies().get(PROFILE_COOKIE)?.value
  const match = raw ? profiles.find((profile) => profile.id === raw) : undefined
  return {
    userId,
    profiles,
    profile: match ?? (!raw && profiles.length === 1 ? profiles[0] : null),
    cookie: match ? 'valid' : raw ? 'invalid' : 'missing',
    loginAt: session.loginAt,
  }
})

/**
 * Kids filtering for the catalogue. Until a profile is picked on this device we err on the safe
 * side: an account with any Kids profile browses in Kids mode.
 */
export async function getKidsMode(): Promise<boolean> {
  const active = await getActiveProfile()
  if (!active) return false
  if (active.profile) return active.profile.kids
  return active.profiles.some((profile) => profile.kids)
}

/**
 * Whether a grown-up profile can be picked without the account password: not from a Kids profile,
 * and not on a device with no valid pick when the account has Kids profiles (clearing the cookie
 * mustn't unlock), unless the user has only just signed in.
 */
export function canSwitchFreely(active: ActiveProfile) {
  if (active.profile) return !active.profile.kids
  if (!active.profiles.some((profile) => profile.kids)) return true
  return typeof active.loginAt === 'number' && Date.now() - active.loginAt < FRESH_LOGIN_MS
}

export function toProfilesResponse(active: ActiveProfile): ProfilesResponse {
  return {
    profiles: active.profiles,
    activeId: active.profile?.id ?? null,
    needsPick: !active.profile,
    locked: !canSwitchFreely(active),
  }
}

/**
 * For API routes that read or write a profile's data: the session user and their active profile,
 * or the error response to return (401 guest, 403 foreign/unknown profile id, 409 none picked).
 */
export async function requireActiveProfile(): Promise<
  { userId: string, profile: Profile, active: ActiveProfile } | { error: NextResponse }
> {
  const active = await getActiveProfile()
  if (!active) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (active.cookie === 'invalid') {
    return { error: NextResponse.json({ error: 'This profile does not belong to your account' }, { status: 403 }) }
  }
  if (!active.profile) return { error: NextResponse.json({ error: 'No profile selected' }, { status: 409 }) }
  return { userId: active.userId, profile: active.profile, active }
}

/** Creating, editing and deleting profiles needs a grown-up profile in use (Kids can't unlock themselves). */
export async function requireGrownUpProfile() {
  const result = await requireActiveProfile()
  if (!('error' in result) && result.profile.kids) {
    return { error: NextResponse.json({ error: 'Switch to a grown-up profile to manage profiles' }, { status: 403 }) }
  }
  return result
}

export const profileCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
}
