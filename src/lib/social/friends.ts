// The social graph: mutual friendships between profiles, and blocks (which cover whole accounts).
import 'server-only'
import { socialDb, type FriendshipDoc } from './db'
import { isBlockedWith, pairKey } from './rules'
import type { ProfileRef, Relationship } from './types'

export const MAX_FRIENDS = 500
export const MAX_PENDING_OUTGOING = 50

/** The other side of a friendship row, seen from `profileId`. */
export function otherSide(row: Pick<FriendshipDoc, 'profiles' | 'users'>, profileId: string): ProfileRef {
  const index = row.profiles[0] === profileId ? 1 : 0
  return { profileId: row.profiles[index], userId: row.users[index] }
}

/** My side of a friendship row. */
export function mySide(row: Pick<FriendshipDoc, 'profiles' | 'users'>, profileId: string): ProfileRef {
  const index = row.profiles[0] === profileId ? 0 : 1
  return { profileId: row.profiles[index], userId: row.users[index] }
}

export async function isBlockedEitherWay(a: ProfileRef, b: ProfileRef): Promise<boolean> {
  const { blocks } = await socialDb()
  return isBlockedWith(blocks, a, b)
}

/** The accounts on the other side of any block that involves `userId` (either direction). */
export async function blockedAccounts(userId: string): Promise<Set<string>> {
  const { blocks } = await socialDb()
  const rows = await blocks.find(
    { $or: [{ blockerUserId: userId }, { blockedUserId: userId }] },
    { projection: { blockerUserId: 1, blockedUserId: 1 } },
  ).toArray()
  return new Set(rows.map((row) => (row.blockerUserId === userId ? row.blockedUserId : row.blockerUserId)))
}

/** Accepted friendship rows of a profile (blocks filtered out), most recently active first. */
export async function friendRows(profileId: string, limit = 0): Promise<FriendshipDoc[]> {
  const { friendships } = await socialDb()
  const cursor = friendships.find({ profiles: profileId, status: 'accepted' }).sort({ lastActivityAt: -1, acceptedAt: -1 })
  if (limit) cursor.limit(limit)
  const rows = await cursor.toArray()
  if (rows.length === 0) return rows
  const me = mySide(rows[0], profileId)
  const blocked = await blockedAccounts(me.userId)
  return blocked.size ? rows.filter((row) => !blocked.has(otherSide(row, profileId).userId)) : rows
}

export async function getFriends(profileId: string): Promise<ProfileRef[]> {
  return (await friendRows(profileId)).map((row) => otherSide(row, profileId))
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false
  const { friendships } = await socialDb()
  const row = await friendships.findOne({ pair: pairKey(a, b), status: 'accepted' })
  if (!row) return false
  return !(await isBlockedEitherWay(mySide(row, a), otherSide(row, a)))
}

/**
 * How `viewer` stands with `owner`. A request that was declined still reads as 'outgoing' to the
 * person who sent it (a declined request is never announced).
 */
export async function relationship(viewer: ProfileRef | null, owner: ProfileRef): Promise<Relationship> {
  if (!viewer) return 'none'
  if (viewer.profileId === owner.profileId) return 'self'
  if (await isBlockedEitherWay(viewer, owner)) return 'blocked'
  const { friendships } = await socialDb()
  const row = await friendships.findOne({ pair: pairKey(viewer.profileId, owner.profileId) })
  if (row?.status === 'accepted') return 'friends'
  if (row?.status === 'pending') return row.requestedBy === viewer.profileId ? 'outgoing' : 'incoming'
  if (row?.status === 'declined' && row.requestedBy === viewer.profileId) return row.requesterCancelled ? 'none' : 'outgoing'
  // A decline covers every profile of the account that sent the request.
  const tombstone = await friendships.findOne({ status: 'declined', profiles: owner.profileId, requestedByUser: viewer.userId, requesterCancelled: { $ne: true } })
  return tombstone ? 'outgoing' : 'none'
}

/** How many friends and outgoing requests a profile has (for the caps). */
export async function graphCounts(profileId: string) {
  const { friendships } = await socialDb()
  const [friends, outgoing] = await Promise.all([
    friendships.countDocuments({ profiles: profileId, status: 'accepted' }),
    friendships.countDocuments({ profiles: profileId, status: 'pending', requestedBy: profileId }),
  ])
  return { friends, outgoing }
}
