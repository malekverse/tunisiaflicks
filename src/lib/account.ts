// Account self-service: export everything we store about a user, or delete it all.
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { deleteSocialData, exportSocialData } from '@/src/lib/social/account'
import { deleteDigestData, exportDigestData } from '@/src/lib/digest/db'
import { onAccountDeleted as handOverSharedLists, exportMemberships } from '@/src/lib/shared-lists/account'
import { onAccountDeleted as leaveMovieNights, exportUserNights } from '@/src/lib/movie-night'
import { deleteBadgeData, exportBadgeData } from '@/src/lib/badges/view'
import { deleteTvSessions, listTvSessions } from '@/src/lib/tv-sessions'

// Never exported, never shown: secrets and one-time tokens.
const SECRET_FIELDS = { password: 0, resetToken: 0, resetTokenExpiry: 0, verifyTokenHash: 0, verifyTokenExpiry: 0 }

// Collections holding per-user documents keyed by the user id (as a string). Lists are not here:
// a shared list is handed over to another member first (see deleteUserData).
const USER_COLLECTIONS = ['userContent', 'follows', 'notifications', 'wrappedShares', 'pushSubscriptions'] as const

/** Everything stored about a user, as one JSON-friendly object (the "download my data" file). */
export async function exportUserData(userId: string) {
  const db = (await clientPromise).db()
  const hidden = { projection: { _id: 0, userId: 0 } }
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: SECRET_FIELDS })
  const [userContent, follows, notifications, wrappedShares, messages] = await Promise.all([
    db.collection('userContent').find({ userId }, hidden).toArray(),
    db.collection('follows').find({ userId }, hidden).toArray(),
    db.collection('notifications').find({ userId }, hidden).sort({ created_at: -1 }).limit(1000).toArray(),
    db.collection('wrappedShares').find({ userId }, hidden).toArray(),
    db.collection('contactMessages').find({ userId }, hidden).toArray(),
  ])
  return {
    exportedAt: new Date().toISOString(),
    service: 'TunisiaFlicks',
    account: user ? { ...user, _id: String(user._id) } : null,
    favoritesBookmarksHistory: userContent,
    follows,
    notifications,
    // Lists you own or help build; never other members' ids.
    lists: await exportMemberships(userId),
    wrappedShares,
    contactMessages: messages,
    social: await exportSocialData(userId),
    weeklyDigest: await exportDigestData(userId),
    movieNights: await exportUserNights(userId),
    badges: await exportBadgeData(userId),
    signedInTvs: await listTvSessions(userId),
  }
}

/**
 * Permanently deletes an account and everything attached to it. Contact / DMCA messages are kept
 * (copyright notices must be retained) but detached from the account.
 */
export async function deleteUserData(userId: string) {
  const db = (await clientPromise).db()
  const _id = new ObjectId(userId)
  // 1. What other people share with this account, while its profiles can still be read: shared
  // lists go to their longest-standing editor, then hosted movie nights are cancelled (guests are
  // told) and the account leaves other nights' guest lists and votes.
  await handOverSharedLists(userId)
  await leaveMovieNights(userId)
  // 2. Each feature's own data: friends (friendships, invites, ratings, pages), the digest's
  // preferences and deliveries, badges and the play log (and supporter records), signed-in TVs.
  await deleteSocialData(userId)
  await deleteDigestData(userId)
  await deleteBadgeData(userId)
  await deleteTvSessions(userId)
  // 3. Everything else keyed by the account.
  await Promise.all([
    ...USER_COLLECTIONS.map((name) => db.collection(name).deleteMany({ userId })),
    // next-auth adapter collections (Google sign-in links), keyed by ObjectId.
    db.collection('accounts').deleteMany({ userId: _id }),
    db.collection('sessions').deleteMany({ userId: _id }),
    db.collection('contactMessages').updateMany({ userId }, { $set: { userId: null } }),
  ])
  await db.collection('users').deleteOne({ _id })
}
