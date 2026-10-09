// Supporters, through Ko-fi (free). Ko-fi calls our webhook for every coffee; we keep only what it
// takes to say thank you: which account it was (by the TF- code in the message, or else a keyed
// hash of the e-mail matched against verified accounts), when, and how many times. Never an
// e-mail, a name, an amount or a message.
//
// supporters    {_id: userId, since, lastAt, count, listed, listName (≤30), badgePublic}
// supportEvents {_id: 'kofi:<transaction id>', at, emailKey, code, userId, expireAt (+400 days)}
// users.supportCode  'TF-' + 5 characters (sparse unique index), shown on /support.
import 'server-only'
import { ObjectId, type Collection } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { findUserByEmail } from '@/src/lib/users'
import {
  LIST_NAME_MAX, MAX_WEBHOOK_BYTES, SUPPORT_CODE_RE, cleanListName, emailKey, findSupportCode,
  newSupportCode, normalizeEmail, parseKofiBody, tokenMatches, type KofiPayload,
} from '@/src/lib/badges/kofi'

export {
  LIST_NAME_MAX, MAX_WEBHOOK_BYTES, SUPPORT_CODE_RE, cleanListName, emailKey, findSupportCode,
  newSupportCode, normalizeEmail, parseKofiBody, tokenMatches, type KofiPayload,
}

export type SupporterDoc = {
  _id: string
  since: Date
  lastAt: Date
  count: number
  /** 'Thank me by name' on /support. */
  listed: boolean
  listName: string
  /** 'Show my supporter badge on my page'. */
  badgePublic: boolean
}

export type SupportEventDoc = {
  _id: string
  at: Date
  emailKey: string | null
  code: string | null
  userId: string | null
  expireAt: Date
}

const EVENT_TTL_DAYS = 400
/** A signed-in supporter's e-mail is matched against unclaimed coffees at most this often. */
export const CLAIM_EVERY_MS = 12 * 60 * 60 * 1000

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000

let ready: Promise<unknown> | null = null

export async function supportDb(): Promise<{ supporters: Collection<SupporterDoc>; events: Collection<SupportEventDoc>; users: Collection }> {
  const db = (await clientPromise).db()
  const supporters = db.collection<SupporterDoc>('supporters')
  const events = db.collection<SupportEventDoc>('supportEvents')
  const users = db.collection('users')
  ready ??= Promise.all([
    supporters.createIndex({ listed: 1, since: 1 }),
    events.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    events.createIndex({ emailKey: 1, userId: 1 }),
    users.createIndex({ supportCode: 1 }, { unique: true, sparse: true }),
  ]).catch((error) => {
    ready = null
    console.error('support: creating indexes failed', error)
  })
  await ready
  return { supporters, events, users }
}

/** The webhook works only with both secrets set (SUPPORT_HASH_SECRET is never NEXTAUTH_SECRET). */
export function supportSecrets(): { token: string; hashSecret: string } | null {
  const token = process.env.KOFI_VERIFICATION_TOKEN?.trim()
  const hashSecret = process.env.SUPPORT_HASH_SECRET?.trim()
  return token && hashSecret ? { token, hashSecret } : null
}

const transactionId = (payload: KofiPayload): string | null => {
  const id = typeof payload.kofi_transaction_id === 'string' && payload.kofi_transaction_id
    ? payload.kofi_transaction_id
    : typeof payload.message_id === 'string' ? payload.message_id : ''
  return /^[A-Za-z0-9_-]{1,100}$/.test(id) ? id : null
}

/** Records one more coffee for an account and makes sure the badge gets announced. */
async function credit(userId: string, at: Date): Promise<void> {
  const { supporters } = await supportDb()
  await supporters.updateOne(
    { _id: userId },
    {
      $min: { since: at },
      $max: { lastAt: at },
      $inc: { count: 1 },
      $setOnInsert: { listed: false, listName: '', badgePublic: false },
    },
    { upsert: true },
  ).catch(async (error) => {
    if (!isDuplicateKey(error)) throw error
    await supporters.updateOne({ _id: userId }, { $min: { since: at }, $max: { lastAt: at }, $inc: { count: 1 } })
  })
  // The thank-you badge, in the inbox of the account's first grown-up profile (best effort).
  try {
    const { announceSupporter } = await import('@/src/lib/badges/announce')
    await announceSupporter(userId)
  } catch (error) {
    console.error('support: announcing the badge failed', error)
  }
}

export type KofiResult = 'linked' | 'pending' | 'duplicate' | 'ignored'

/**
 * One Ko-fi event (the token already checked). Idempotent: the same transaction twice is a
 * duplicate. A TF- code in the message wins; otherwise a verified account with the same e-mail.
 * Unmatched events wait (hashed) for their account to claim them (claimSupport).
 */
export async function processKofi(payload: KofiPayload, hashSecret: string, now: Date = new Date()): Promise<KofiResult> {
  const id = transactionId(payload)
  if (!id) return 'ignored'
  const { events, users } = await supportDb()
  const code = findSupportCode(payload.message)
  const email = typeof payload.email === 'string' && payload.email.includes('@') && payload.email.length <= 320 ? payload.email : null
  const key = email ? emailKey(email, hashSecret) : null
  const at = typeof payload.timestamp === 'string' && !Number.isNaN(Date.parse(payload.timestamp)) && Date.parse(payload.timestamp) <= now.getTime()
    ? new Date(payload.timestamp)
    : now

  let userId: string | null = null
  if (code) {
    const owner = await users.findOne({ supportCode: code }, { projection: { _id: 1 } })
    if (owner) userId = String(owner._id)
  }
  if (!userId && email) {
    const owner = await findUserByEmail(normalizeEmail(email))
    if (owner?.emailVerified) userId = String(owner._id)
  }

  try {
    await events.insertOne({
      _id: `kofi:${id}`,
      at,
      emailKey: key,
      code,
      userId,
      expireAt: new Date(now.getTime() + EVENT_TTL_DAYS * 86_400_000),
    })
  } catch (error) {
    if (isDuplicateKey(error)) return 'duplicate'
    throw error
  }
  if (!userId) return 'pending'
  await credit(userId, at)
  return 'linked'
}

/** The account's support code, made on first use. */
export async function ensureSupportCode(userId: string): Promise<string | null> {
  if (!ObjectId.isValid(userId)) return null
  const { users } = await supportDb()
  const _id = new ObjectId(userId)
  const current = await users.findOne({ _id }, { projection: { supportCode: 1 } })
  if (!current) return null
  if (typeof current.supportCode === 'string' && SUPPORT_CODE_RE.test(current.supportCode)) return current.supportCode
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newSupportCode()
    try {
      const result = await users.updateOne({ _id, supportCode: { $exists: false } }, { $set: { supportCode: code } })
      if (result.modifiedCount === 1) return code
      const again = await users.findOne({ _id }, { projection: { supportCode: 1 } })
      if (typeof again?.supportCode === 'string') return again.supportCode
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
    }
  }
  return null
}

/**
 * Coffees bought with this account's (verified) e-mail before anything linked them: claimed now,
 * at most every 12 hours.
 */
export async function claimSupport(userId: string, now: Date = new Date()): Promise<number> {
  const secrets = supportSecrets()
  if (!secrets || !ObjectId.isValid(userId)) return 0
  const { events, users } = await supportDb()
  const _id = new ObjectId(userId)
  const due = await users.findOneAndUpdate(
    { _id, emailVerified: { $exists: true, $nin: [null, false] }, $or: [{ supportCheckedAt: { $exists: false } }, { supportCheckedAt: { $lt: new Date(now.getTime() - CLAIM_EVERY_MS) } }] },
    { $set: { supportCheckedAt: now } },
    { projection: { email: 1 } },
  )
  const email = due.value?.email
  if (typeof email !== 'string' || !email) return 0
  const key = emailKey(email, secrets.hashSecret)
  let claimed = 0
  for (const event of await events.find({ emailKey: key, userId: null }).limit(50).toArray()) {
    const result = await events.updateOne({ _id: event._id, userId: null }, { $set: { userId } })
    if (result.modifiedCount === 1) {
      claimed++
      await credit(userId, event.at)
    }
  }
  return claimed
}

export async function getSupporter(userId: string): Promise<SupporterDoc | null> {
  const { supporters } = await supportDb()
  return supporters.findOne({ _id: userId })
}

export async function setSupporterPrefs(userId: string, prefs: { badgePublic?: boolean; listed?: boolean; listName?: string }): Promise<SupporterDoc | null> {
  const { supporters } = await supportDb()
  const set: Partial<SupporterDoc> = {}
  if (typeof prefs.badgePublic === 'boolean') set.badgePublic = prefs.badgePublic
  if (typeof prefs.listed === 'boolean') set.listed = prefs.listed
  if (typeof prefs.listName === 'string') set.listName = prefs.listName
  if (Object.keys(set).length === 0) return getSupporter(userId)
  const result = await supporters.findOneAndUpdate({ _id: userId }, { $set: set }, { returnDocument: 'after' })
  return result.value ?? null
}

/** The names on /support: supporters who asked to be thanked by name, oldest first. */
export async function supporterCredits(limit = 200): Promise<string[]> {
  const { supporters } = await supportDb()
  const rows = await supporters.find({ listed: true, listName: { $ne: '' } }, { projection: { listName: 1 } }).sort({ since: 1 }).limit(limit).toArray()
  return rows.map((row) => row.listName).filter((name) => !!name)
}

/** Everything the support side keeps about an account (export). */
export async function exportSupportData(userId: string): Promise<unknown> {
  const { supporters, events } = await supportDb()
  const [supporter, coffees] = await Promise.all([
    supporters.findOne({ _id: userId }),
    events.countDocuments({ userId }),
  ])
  return supporter ? { since: supporter.since, lastAt: supporter.lastAt, count: supporter.count, listed: supporter.listed, listName: supporter.listName, badgePublic: supporter.badgePublic, linkedCoffees: coffees } : null
}

/** Account deletion: the supporter record and the coffees linked to it. */
export async function deleteSupportData(userId: string): Promise<void> {
  const { supporters, events } = await supportDb()
  await Promise.all([supporters.deleteOne({ _id: userId }), events.deleteMany({ userId })])
}
