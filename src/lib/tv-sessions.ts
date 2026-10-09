// The TVs signed in with a code (see src/lib/tv-pairing.ts). Each one is a tvSessions document that
// the TV's session token points at (token.pairingId); the jwt callback in src/lib/auth.ts re-checks
// it every 5 minutes, so signing a TV out in Settings #security takes effect within 5 minutes.
// Revoked entries are kept 30 days (TTL), entries of TVs unused for 60 days go too.
import { randomBytes } from 'node:crypto'
import { isDeviceLabel, type DeviceLabel } from '@/src/lib/tv-pairing'

export type TvSession = {
  _id: string
  userId: string
  profileId: string
  deviceLabel: DeviceLabel
  createdAt: Date
  lastSeenAt: Date
  revokedAt: Date | null
}

/** What Settings shows of a TV. */
export type TvSessionView = { id: string; deviceLabel: DeviceLabel; profileId: string; createdAt: string; lastSeenAt: string }

/** How often a TV's token is re-checked (and its lastSeenAt refreshed). */
export const TV_SESSION_CHECK_MS = 5 * 60 * 1000

export const isTvSessionId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{24}$/.test(value)

let indexes: Promise<unknown> | null = null

async function sessions() {
  const client = await (await import('@/src/lib/mongodb')).default
  const collection = client.db().collection<TvSession>('tvSessions')
  indexes ??= Promise.all([
    collection.createIndex({ userId: 1, revokedAt: 1 }),
    collection.createIndex({ revokedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }),
    collection.createIndex({ lastSeenAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 }),
  ]).catch((error) => {
    indexes = null
    console.error('tvSessions indexes:', error)
  })
  await indexes
  return collection
}

/** A new signed-in TV (made by the 'tv-pair' provider when a pairing is used). Its id. */
export async function createTvSession({ userId, profileId, deviceLabel }: { userId: string; profileId: string; deviceLabel: DeviceLabel }): Promise<string> {
  const now = new Date()
  const id = randomBytes(18).toString('base64url')
  await (await sessions()).insertOne({ _id: id, userId, profileId, deviceLabel: isDeviceLabel(deviceLabel) ? deviceLabel : 'other', createdAt: now, lastSeenAt: now, revokedAt: null })
  return id
}

/**
 * The 5-minute re-check: true (still signed in; lastSeenAt refreshed), false (revoked or gone), or
 * null when the database can't be reached (the caller keeps the token and asks again next time).
 */
export async function touchTvSession(id: string | undefined): Promise<boolean | null> {
  if (!isTvSessionId(id)) return false
  try {
    const result = await (await sessions()).updateOne({ _id: id, revokedAt: null }, { $set: { lastSeenAt: new Date() } })
    return result.matchedCount === 1
  } catch (error) {
    console.error('tvSessions check:', error)
    return null
  }
}

/** The account's TVs, most recently used first. */
export async function listTvSessions(userId: string): Promise<TvSessionView[]> {
  const docs = await (await sessions()).find({ userId, revokedAt: null }).sort({ lastSeenAt: -1 }).limit(50).toArray()
  return docs.map((doc) => ({
    id: doc._id,
    deviceLabel: isDeviceLabel(doc.deviceLabel) ? doc.deviceLabel : 'other',
    profileId: doc.profileId,
    createdAt: doc.createdAt.toISOString(),
    lastSeenAt: doc.lastSeenAt.toISOString(),
  }))
}

/** Signs one of the account's TVs out. False when it isn't one of them (or was already signed out). */
export async function revokeTvSession(userId: string, id: string): Promise<boolean> {
  if (!isTvSessionId(id)) return false
  const result = await (await sessions()).updateOne({ _id: id, userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
  return result.modifiedCount === 1
}

/** Account deletion: every TV of the account, gone. */
export async function deleteTvSessions(userId: string): Promise<void> {
  await (await sessions()).deleteMany({ userId })
}

/** A profile is deleted: the TVs pinned to it are signed out. */
export async function revokeTvSessionsForProfile(userId: string, profileId: string): Promise<void> {
  await (await sessions()).updateMany({ userId, profileId, revokedAt: null }, { $set: { revokedAt: new Date() } })
}
