// Web push (free, standard VAPID): browser/installed-app notifications for the daily pick and for
// followed titles. Off unless VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set
// (generate them once with `npx web-push generate-vapid-keys`).
import { createHash } from 'crypto'
import webpush from 'web-push'
import clientPromise from '@/src/lib/mongodb'
import type { Locale } from '@/src/lib/i18n'

export type PushTopic = 'pick' | 'alerts'

export type PushPayload = {
  title: string
  body: string
  /** Page opened when the notification is clicked (same-origin path). */
  url: string
  /** Large picture (backdrop), shown by Android/desktop Chrome. */
  image?: string
  /** Notifications with the same tag replace each other. */
  tag?: string
}

export type PushSubscriptionDoc = {
  _id: string
  endpoint: string
  keys: { p256dh: string, auth: string }
  userId: string | null
  topics: PushTopic[]
  locale: Locale
  created_at: Date
  last_sent_at?: Date
  /** Tunis date the daily pick was sent on (see daily-push.ts). */
  pick_sent_on?: string
}

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null

let configured = false
export function pushEnabled() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  if (!configured) {
    const contact = process.env.VAPID_SUBJECT || `mailto:${process.env.CONTACT_EMAIL || process.env.FROM_EMAIL || 'admin@tunisiaflicks.app'}`
    webpush.setVapidDetails(contact, publicKey, privateKey)
    configured = true
  }
  return true
}

/** Stable id for a subscription (endpoints are long URLs). */
export const subscriptionId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex')

export async function pushCollection() {
  const collection = (await clientPromise).db().collection<PushSubscriptionDoc>('pushSubscriptions')
  await collection.createIndex({ topics: 1 }).catch(() => {})
  await collection.createIndex({ userId: 1 }).catch(() => {})
  return collection
}

/** Push service endpoints are https URLs on the browser vendors' push services. */
export function isValidSubscription(value: any): value is { endpoint: string, keys: { p256dh: string, auth: string } } {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 1000) return false
  if (!value.keys || typeof value.keys.p256dh !== 'string' || typeof value.keys.auth !== 'string') return false
  try {
    return new URL(value.endpoint).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Sends one notification. Subscriptions the push service reports as gone (404/410) are deleted.
 * Resolves to whether it was delivered to the push service.
 */
export async function sendPush(doc: PushSubscriptionDoc, payload: PushPayload): Promise<boolean> {
  if (!pushEnabled()) return false
  const collection = await pushCollection()
  try {
    await webpush.sendNotification({ endpoint: doc.endpoint, keys: doc.keys }, JSON.stringify(payload), { TTL: 12 * 3600, urgency: 'normal' })
    await collection.updateOne({ _id: doc._id }, { $set: { last_sent_at: new Date() } })
    return true
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await collection.deleteOne({ _id: doc._id })
    } else {
      console.error('Push failed:', error?.statusCode ?? error)
    }
    return false
  }
}

/** Sends to many subscriptions, a few at a time, until `deadline`. */
export async function sendPushToAll(
  docs: PushSubscriptionDoc[],
  payloadFor: (doc: PushSubscriptionDoc) => PushPayload,
  deadline = Date.now() + 20_000,
) {
  const stats = { sent: 0, failed: 0, skipped: [] as string[] }
  let next = 0
  const worker = async () => {
    while (next < docs.length) {
      const doc = docs[next++]
      if (Date.now() > deadline) { stats.skipped.push(doc._id); continue }
      if (await sendPush(doc, payloadFor(doc))) stats.sent++
      else stats.failed++
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return stats
}

/** A signed-in user's devices that want release alerts. */
export async function pushToUser(userId: string, payloadFor: (doc: PushSubscriptionDoc) => PushPayload) {
  if (!pushEnabled()) return
  const docs = await (await pushCollection()).find({ userId, topics: 'alerts' }).toArray()
  if (docs.length) await sendPushToAll(docs, payloadFor, Date.now() + 5_000)
}
