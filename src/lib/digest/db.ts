// Where the weekly digest keeps its state:
//
// - digestPrefs: one document per profile (_id = profile id): whether it gets the digest, in which
//   language, and whether its address bounced. Off unless the profile turned it on.
// - digestEditions: one per week (_id = its Friday): the run's phase, the snapshot shared by
//   everyone reading in one language, and counts. Kept a year.
// - digestDeliveries: one per (edition, profile) (_id = '<edition>:<profileId>'), the at-most-once
//   record of each e-mail: queued -> building -> sending -> sent, or skipped / failed / unknown /
//   expired. Kept 120 days.
//
// The account-wide switch for release e-mails lives on the user: users.emailPrefs.releaseAlerts
// (true when missing).
import clientPromise from '@/src/lib/mongodb'
import type { Locale } from '@/src/lib/i18n/locales'
import type { SharedSnapshot } from '@/src/lib/digest/compose'

const DAY = 86400000
export const EDITION_TTL_DAYS = 365
export const DELIVERY_TTL_DAYS = 120

export type DigestPrefs = {
  _id: string
  userId: string
  enabled: boolean
  locale: Locale
  created_at: Date
  updated_at: Date
  /** Set by the unsubscribe link (the page offers to undo it for 24 hours). */
  unsubscribed_at?: Date | null
  /** 'bounced': two hard bounces in a row; nothing is sent until it's turned on again. */
  paused_reason?: 'bounced' | null
  hard_bounces: number
  last_edition?: string | null
}

export type EditionPhase = 'snapshot' | 'enqueue' | 'send' | 'closed'

export type EditionDoc = {
  _id: string
  opens_at: Date
  closes_at: Date
  in_ramadan: boolean
  phase: EditionPhase
  /** The last profile id enqueued (profiles are enqueued in _id order, 500 at a time). */
  enqueue_cursor: string | null
  shared: Partial<Record<string, SharedSnapshot & { built_at: Date }>>
  counts: Partial<Record<DeliveryStatus | 'enqueued', number>>
  created_at: Date
  expires_at: Date
}

export type DeliveryStatus = 'queued' | 'building' | 'sending' | 'sent' | 'skipped' | 'failed' | 'unknown' | 'expired'

export type DeliveryDoc = {
  _id: string
  edition: string
  profileId: string
  userId: string
  status: DeliveryStatus
  /** Which run holds it while building / sending. */
  claim?: string | null
  claimed_at?: Date | null
  attempts: number
  /** Why it was skipped or failed ('off', 'thin', 'bounce'...). */
  reason?: string | null
  sent_at?: Date | null
  created_at: Date
  updated_at: Date
  expires_at: Date
}

let ready: Promise<unknown> | null = null

export async function digestCollections() {
  const db = (await clientPromise).db()
  const prefs = db.collection<DigestPrefs>('digestPrefs')
  const editions = db.collection<EditionDoc>('digestEditions')
  const deliveries = db.collection<DeliveryDoc>('digestDeliveries')
  ready ??= Promise.all([
    prefs.createIndex({ enabled: 1, _id: 1 }, { name: 'enabled_only', partialFilterExpression: { enabled: true } }),
    prefs.createIndex({ userId: 1 }),
    editions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    deliveries.createIndex({ edition: 1, status: 1, _id: 1 }),
    deliveries.createIndex({ userId: 1 }),
    deliveries.createIndex({ profileId: 1 }),
    deliveries.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    ready = null
    console.error('Digest indexes:', error)
  })
  await ready
  return { db, prefs, editions, deliveries, users: db.collection('users') }
}

export const editionExpiry = (from: Date = new Date()) => new Date(from.getTime() + EDITION_TTL_DAYS * DAY)
export const deliveryExpiry = (from: Date = new Date()) => new Date(from.getTime() + DELIVERY_TTL_DAYS * DAY)
export const deliveryId = (edition: string, profileId: string) => `${edition}:${profileId}`

/** A profile was deleted: its digest settings and delivery records go with it. */
export async function deleteDigestPrefs(profileId: string) {
  const { prefs, deliveries } = await digestCollections()
  await Promise.all([prefs.deleteOne({ _id: profileId }), deliveries.deleteMany({ profileId })])
}

/** An account was deleted: every profile's digest settings and delivery records. */
export async function deleteDigestData(userId: string) {
  const { prefs, deliveries } = await digestCollections()
  await Promise.all([prefs.deleteMany({ userId }), deliveries.deleteMany({ userId })])
}

/** For "download my data": the digest settings of each profile and the last e-mails sent. */
export async function exportDigestData(userId: string) {
  const { prefs, deliveries } = await digestCollections()
  const [settings, sent] = await Promise.all([
    prefs.find({ userId }, { projection: { userId: 0 } }).toArray(),
    deliveries.find({ userId }, { projection: { _id: 0, userId: 0, claim: 0, claimed_at: 0, expires_at: 0 } }).sort({ created_at: -1 }).limit(200).toArray(),
  ])
  return {
    digestSettings: settings.map(({ _id, ...rest }) => ({ profileId: _id, ...rest })),
    digestDeliveries: sent,
  }
}
