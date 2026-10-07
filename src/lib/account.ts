// Account self-service: export everything we store about a user, or delete it all.
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'

// Never exported, never shown: secrets and one-time tokens.
const SECRET_FIELDS = { password: 0, resetToken: 0, resetTokenExpiry: 0, verifyTokenHash: 0, verifyTokenExpiry: 0 }

// Collections holding per-user documents keyed by the user id (as a string).
const USER_COLLECTIONS = ['userContent', 'follows', 'notifications', 'lists', 'wrappedShares', 'pushSubscriptions'] as const

/** Everything stored about a user, as one JSON-friendly object (the "download my data" file). */
export async function exportUserData(userId: string) {
  const db = (await clientPromise).db()
  const hidden = { projection: { _id: 0, userId: 0 } }
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: SECRET_FIELDS })
  const [userContent, follows, notifications, lists, wrappedShares, messages] = await Promise.all([
    db.collection('userContent').find({ userId }, hidden).toArray(),
    db.collection('follows').find({ userId }, hidden).toArray(),
    db.collection('notifications').find({ userId }, hidden).sort({ created_at: -1 }).limit(1000).toArray(),
    db.collection('lists').find({ userId }, hidden).toArray(),
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
    publicLists: lists,
    wrappedShares,
    contactMessages: messages,
  }
}

/**
 * Permanently deletes an account and everything attached to it. Contact / DMCA messages are kept
 * (copyright notices must be retained) but detached from the account.
 */
export async function deleteUserData(userId: string) {
  const db = (await clientPromise).db()
  const _id = new ObjectId(userId)
  await Promise.all([
    ...USER_COLLECTIONS.map((name) => db.collection(name).deleteMany({ userId })),
    // next-auth adapter collections (Google sign-in links), keyed by ObjectId.
    db.collection('accounts').deleteMany({ userId: _id }),
    db.collection('sessions').deleteMany({ userId: _id }),
    db.collection('contactMessages').updateMany({ userId }, { $set: { userId: null } }),
  ])
  await db.collection('users').deleteOne({ _id })
}
