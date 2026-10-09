// Who is looking at a social page (/friends, /friends/list, /u, /me, /notifications), once per
// request, and the counts the Friends tabs show.
import 'server-only'
import { cache } from 'react'
import { ObjectId } from 'mongodb'
import { getActiveProfile } from '@/src/lib/profiles'
import { socialDb } from '@/src/lib/social/db'
import { blockedAccounts } from '@/src/lib/social/friends'
import { pairKey } from '@/src/lib/social/rules'
import { socialSelf, type SocialProfileDoc } from '@/src/lib/social/session'
import type { ProfileRef } from '@/src/lib/social/types'

export type PageViewer =
  | { kind: 'guest' }
  /** Signed in, no profile picked on this device yet (the profile gate takes them to the picker). */
  | { kind: 'pick' }
  /** A TV signed in with a code: the social layer is off there. */
  | { kind: 'tv'; ref: ProfileRef; kids: boolean }
  | { kind: 'kids'; ref: ProfileRef }
  | { kind: 'member'; ref: ProfileRef; social: SocialProfileDoc | null; verified: boolean; name: string; color: string }

export const pageViewer = cache(async (): Promise<PageViewer> => {
  const active = await getActiveProfile()
  if (!active) return { kind: 'guest' }
  const self = await socialSelf()
  if (!self) return { kind: 'pick' }
  if (self.limited) return { kind: 'tv', ref: self.ref, kids: self.kids }
  if (self.kids) return { kind: 'kids', ref: self.ref }
  return { kind: 'member', ref: self.ref, social: self.social, verified: self.verified, name: self.profileName, color: self.color }
})

/**
 * Friend requests waiting for this profile, and how many of them are still unread in the inbox
 * (the Friends tab shows a red dot only for those; otherwise a quiet count). Nothing from an
 * account on either side of a block.
 */
export async function requestCounts(ref: ProfileRef): Promise<{ waiting: number; unread: number }> {
  const { friendships, notifications } = await socialDb()
  const blocked = Array.from(await blockedAccounts(ref.userId))
  const [waiting, unread] = await Promise.all([
    friendships.countDocuments({ profiles: ref.profileId, status: 'pending', requestedBy: { $ne: ref.profileId }, requestedByUser: { $nin: blocked } }),
    notifications.countDocuments({ userId: ref.userId, profileId: ref.profileId, kind: 'friend_request', read: false, 'action.state': 'pending', 'actor.userId': { $nin: blocked } }),
  ])
  return { waiting, unread }
}

/** Whether a profile is a Kids profile (their page, if any, is never shown). Unknown counts as Kids. */
export async function profileIsKids(ref: ProfileRef): Promise<boolean> {
  if (!ObjectId.isValid(ref.userId)) return true
  const { users } = await socialDb()
  const user = await users.findOne({ _id: new ObjectId(ref.userId) }, { projection: { profiles: 1 } })
  const profile = (user?.profiles ?? []).find((entry: { id?: unknown }) => String(entry?.id) === ref.profileId)
  return !profile || profile.kids === true
}

/** The friendship row between two profiles (its id answers or cancels a request; acceptedAt says since when). */
export async function friendshipBetween(a: string, b: string) {
  const { friendships } = await socialDb()
  return friendships.findOne({ pair: pairKey(a, b) }, { projection: { _id: 1, status: 1, acceptedAt: 1, requestedBy: 1 } })
}
