// The social collections and their documents, with indexes created lazily (once per server
// instance, the first time a collection is used). Native driver (mongodb 5.9).
import 'server-only'
import type { Collection, Db, ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import type { InboxAction, InboxActionType, NotificationKind, PrivacySettings, ProfileRef, ShareMedia } from './types'

/** One per profile that has a page (a handle). _id is the profile id. */
export type SocialProfileDoc = {
  _id: string
  userId: string
  handle: string
  name: string
  bio: string
  /** Show the account photo (only ever on the account owner's profile, profiles[0]). */
  usePhoto: boolean
  color: string
  privacy: PrivacySettings
  /** 16 random bytes, base64url: the page's private link (/u/handle?k=). Rotatable. */
  shareKey: string
  /** Friends only see watches from this moment on (moves when activity is opened up or unpaused). */
  activitySince: Date
  /** Friends only see ratings from this moment on ('Also share my past ratings' sets the epoch). */
  ratingsVisibleSince: Date
  handleChangedAt?: Date
  createdAt: Date
  updatedAt: Date
}

/** _id is the handle. Old handles stay (current: false): they redirect for 30 days, are held for 90. */
export type HandleDoc = {
  _id: string
  profileId: string
  userId: string
  current: boolean
  changedAt?: Date
  /** When an old handle is released (TTL). */
  until?: Date
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined'

export type FriendshipDoc = {
  _id: ObjectId
  /** pairKey(a, b): unique. */
  pair: string
  profiles: [string, string]
  /** The accounts, in the same order as `profiles`. */
  users: [string, string]
  status: FriendshipStatus
  requestedBy: string
  requestedByUser: string
  via: 'handle' | 'invite'
  createdAt: Date
  acceptedAt?: Date
  lastActivityAt?: Date
  /** Pending and declined rows go away after 90 days (TTL). */
  expiresAt?: Date
  /** The sender cancelled a request that had (silently) been declined: hidden, but still a tombstone. */
  requesterCancelled?: boolean
}

export type BlockDoc = {
  blockerProfileId: string
  blockerUserId: string
  blockedProfileId: string
  blockedUserId: string
  createdAt: Date
}

export type InviteDoc = {
  /** sha256(token), hex: the token itself is never stored. */
  _id: string
  kind: 'friend' | 'night' | 'list'
  targetId: string
  owner: ProfileRef
  createdAt: Date
  expiresAt: Date
  maxUses: number
  uses: number
  revokedAt: Date | null
}

export type RatingDoc = {
  userId: string
  profileId: string
  media_type: 'movie' | 'tv'
  tmdbId: string
  stars: number
  title: string
  poster_path: string | null
  kids: boolean
  accountVerified: boolean
  ratedAt: Date
  updatedAt: Date
}

/** The social fields of a `notifications` document (release alerts keep their own, see models/Follow). */
export type SocialNotificationDoc = {
  _id?: ObjectId
  userId: string
  /** null = account-wide (release alerts). */
  profileId: string | null
  kind: NotificationKind
  event_key: string
  href: string
  text?: { key: string; vars?: Record<string, string | number> }
  actor?: ProfileRef | null
  /** The latest few actors of a merged notification (newest first, at most 3). */
  actors?: ProfileRef[]
  actorCount?: number
  media?: ShareMedia | null
  image?: string | null
  note?: string | null
  action?: InboxAction | null
  merge_key?: string | null
  kidsVisible?: boolean
  kidSafe?: boolean
  created_at: Date
  read: boolean
  email_status: 'none' | 'pending' | 'sending' | 'sent' | 'failed'
  // Release alerts (legacy fields).
  media_type?: 'movie' | 'tv'
  tmdbId?: string
  title?: string
  poster_path?: string | null
  episode?: { season: number; episode: number; air_date?: string | null; name?: string | null } | null
}

export type { InboxActionType }

const DAY = 24 * 60 * 60

let ready: Promise<unknown> | null = null

function ensureIndexes(db: Db) {
  ready ??= Promise.all([
    db.collection('socialProfiles').createIndex({ handle: 1 }, { unique: true }),
    db.collection('socialProfiles').createIndex({ userId: 1 }),
    db.collection('handles').createIndex({ profileId: 1, current: 1 }),
    db.collection('handles').createIndex({ userId: 1 }),
    db.collection('handles').createIndex({ until: 1 }, { expireAfterSeconds: 0 }),
    db.collection('friendships').createIndex({ pair: 1 }, { unique: true }),
    db.collection('friendships').createIndex({ profiles: 1, status: 1 }),
    db.collection('friendships').createIndex({ users: 1 }),
    db.collection('friendships').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('blocks').createIndex({ blockerProfileId: 1, blockedProfileId: 1 }, { unique: true }),
    db.collection('blocks').createIndex({ blockerUserId: 1, blockedUserId: 1 }),
    db.collection('blocks').createIndex({ blockedUserId: 1 }),
    db.collection('invites').createIndex({ kind: 1, targetId: 1, createdAt: -1 }),
    db.collection('invites').createIndex({ 'owner.userId': 1 }),
    db.collection('invites').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('ratings').createIndex({ profileId: 1, media_type: 1, tmdbId: 1 }, { unique: true }),
    db.collection('ratings').createIndex({ media_type: 1, tmdbId: 1 }),
    db.collection('ratings').createIndex({ profileId: 1, updatedAt: -1 }),
    db.collection('ratings').createIndex({ userId: 1 }),
    db.collection('notifications').createIndex(
      { userId: 1, profileId: 1, merge_key: 1 },
      { partialFilterExpression: { read: false } },
    ),
    db.collection('notifications').createIndex({ 'actor.userId': 1 }, { sparse: true }),
    db.collection('userContent').createIndex({ type: 1, profileId: 1 }),
    db.collection('pushSubscriptions').createIndex({ userId: 1, profileId: 1 }),
  ]).catch((error) => {
    ready = null
    console.error('Social indexes:', error)
  })
  return ready
}

/** Every collection the social layer touches, typed, indexes ensured. */
export async function socialDb() {
  const db = (await clientPromise).db()
  await ensureIndexes(db)
  return {
    db,
    profiles: db.collection<SocialProfileDoc>('socialProfiles'),
    handles: db.collection<HandleDoc>('handles'),
    friendships: db.collection<FriendshipDoc>('friendships'),
    blocks: db.collection<BlockDoc>('blocks'),
    invites: db.collection<InviteDoc>('invites'),
    ratings: db.collection<RatingDoc>('ratings'),
    notifications: db.collection<SocialNotificationDoc>('notifications') as Collection<SocialNotificationDoc>,
    userContent: db.collection('userContent'),
    users: db.collection('users'),
    push: db.collection('pushSubscriptions'),
  }
}

export const DAYS = (n: number) => n * DAY * 1000
