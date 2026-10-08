// The weekly digest job (/api/cron/digest), called every few minutes from Friday evening to
// Monday. Each call does what fits before its deadline and picks up where the last one stopped:
//
//   snapshot  build the week's shared material, once per language in use
//   enqueue   one delivery per profile with the digest on (500 profiles per page)
//   send      3 lanes, at most once each (lib/digest/deliveries), until the queue is empty, the
//             deadline nears, or a mail budget is spent ('quota': the rest waits for tomorrow)
//
// Outside the window it answers 'idle'. Once the window is over, what's left expires (nobody wants
// last Friday's digest on a Tuesday).
import { ObjectId } from 'mongodb'
import { isLocale, type Locale } from '@/src/lib/i18n/locales'
import { bulkTransport, requireEmailEnv } from '@/src/lib/email'
import type { Profile } from '@/src/lib/models/Profile'
import type { CronResult } from '@/src/lib/cron'
import { deliveryExpiry, deliveryId, digestCollections, editionExpiry, type DeliveryDoc } from '@/src/lib/digest/db'
import { MIN_TILES } from '@/src/lib/digest/compose'
import { queuedCount, sendQueued, type SendEngine } from '@/src/lib/digest/deliveries'
import { buildDigest, digestConfigured, editionSnapshot, reserveDigestSend, type DigestMessage } from '@/src/lib/digest/build'
import { editionFor, isOpen, type Edition } from '@/src/lib/digest/schedule'

export const ENQUEUE_PAGE = 500
/** Leave this much time when starting a language's snapshot (it waits on TMDB). */
const SNAPSHOT_RESERVE_MS = 10_000

/** A duplicate key, or a bulk insert whose only failures are duplicates. */
function isDuplicateKey(error: unknown) {
  const failure = error as { code?: number; writeErrors?: { code?: number } | { code?: number }[] }
  if (failure?.code === 11000) return true
  const writes = failure?.writeErrors ? ([] as { code?: number }[]).concat(failure.writeErrors) : []
  return writes.length > 0 && writes.every((write) => write?.code === 11000)
}

/** Expires what an edition left behind once its window is over (once). */
async function closeEdition(edition: Edition): Promise<CronResult> {
  const { editions, deliveries } = await digestCollections()
  const doc = await editions.findOne({ _id: edition.id }, { projection: { phase: 1 } })
  if (!doc || doc.phase === 'closed') return { status: 'idle' }
  const now = new Date()
  const expired = await deliveries.updateMany({ edition: edition.id, status: { $in: ['queued', 'building'] } }, { $set: { status: 'expired', claim: null, updated_at: now } })
  const lost = await deliveries.updateMany({ edition: edition.id, status: 'sending' }, { $set: { status: 'unknown', claim: null, reason: 'interrupted', updated_at: now } })
  await editions.updateOne({ _id: edition.id }, {
    $set: { phase: 'closed' },
    $inc: { 'counts.expired': expired.modifiedCount, 'counts.unknown': lost.modifiedCount },
  })
  return { status: 'done', expired: expired.modifiedCount, unknown: lost.modifiedCount }
}

/** Snapshot phase: the shared material of every language in use. False when time ran out. */
async function snapshotPhase(edition: Edition, deadline: number): Promise<boolean> {
  const { prefs, editions } = await digestCollections()
  const locales = (await prefs.distinct('locale', { enabled: true })).filter(isLocale) as Locale[]
  const doc = await editions.findOne({ _id: edition.id }, { projection: { shared: 1 } })
  for (const locale of locales) {
    if (doc?.shared?.[locale]) continue
    if (Date.now() > deadline - SNAPSHOT_RESERVE_MS) return false
    await editionSnapshot(edition, locale)
  }
  await editions.updateOne({ _id: edition.id, phase: 'snapshot' }, { $set: { phase: 'enqueue' } })
  return true
}

/** Enqueue phase: a delivery per profile with the digest on, a page at a time. False when time ran out. */
async function enqueuePhase(edition: Edition, deadline: number): Promise<{ done: boolean; enqueued: number }> {
  const { prefs, editions, deliveries } = await digestCollections()
  let enqueued = 0
  for (;;) {
    if (Date.now() > deadline - 2000) return { done: false, enqueued }
    const doc = await editions.findOne({ _id: edition.id }, { projection: { enqueue_cursor: 1, phase: 1 } })
    if (doc?.phase !== 'enqueue') return { done: true, enqueued }
    const cursor = doc.enqueue_cursor
    const page = await prefs
      .find({ enabled: true, ...(cursor ? { _id: { $gt: cursor } } : {}) }, { projection: { _id: 1, userId: 1, paused_reason: 1 } })
      .sort({ _id: 1 })
      .limit(ENQUEUE_PAGE)
      .toArray()
    const now = new Date()
    const rows: DeliveryDoc[] = page
      .filter((pref) => !pref.paused_reason)
      .map((pref) => ({
        _id: deliveryId(edition.id, pref._id),
        edition: edition.id,
        profileId: pref._id,
        userId: pref.userId,
        status: 'queued',
        attempts: 0,
        created_at: now,
        updated_at: now,
        expires_at: deliveryExpiry(now),
      }))
    if (rows.length) {
      try {
        const result = await deliveries.insertMany(rows, { ordered: false })
        enqueued += result.insertedCount
      } catch (error) {
        // Already there (an earlier, interrupted page, or turned on during the window): fine.
        if (!isDuplicateKey(error)) throw error
        enqueued += (error as { result?: { insertedCount?: number } })?.result?.insertedCount ?? 0
      }
    }
    const last = page[page.length - 1]?._id ?? cursor
    const finished = page.length < ENQUEUE_PAGE
    await editions.updateOne({ _id: edition.id, phase: 'enqueue' }, {
      $set: { enqueue_cursor: last, ...(finished ? { phase: 'send' as const } : {}) },
      $inc: { 'counts.enqueued': rows.length },
    })
    if (finished) return { done: true, enqueued }
  }
}

/** The engine that builds and sends one profile's digest. */
function engineFor(edition: Edition): SendEngine<DigestMessage> {
  const users = digestCollections().then(({ users }) => users)
  const prefsOf = digestCollections().then(({ prefs }) => prefs)
  return {
    async prepare(delivery) {
      const prefs = await prefsOf
      const pref = await prefs.findOne({ _id: delivery.profileId })
      if (!pref?.enabled) return { skip: 'off' }
      if (pref.paused_reason) return { skip: 'paused' }
      if (!ObjectId.isValid(delivery.userId)) return { skip: 'no_account' }
      const user = await (await users).findOne({ _id: new ObjectId(delivery.userId) }, { projection: { email: 1, emailVerified: 1, profiles: 1 } })
      if (!user?.email) return { skip: 'no_email' }
      if (!user.emailVerified) return { skip: 'unverified' }
      const raw = (user.profiles ?? []).find((profile: any) => String(profile?.id) === delivery.profileId)
      if (!raw) return { skip: 'no_profile' }
      if (raw.kids === true) return { skip: 'kids' }
      const profile: Profile = { id: String(raw.id), name: String(raw.name ?? ''), color: String(raw.color ?? ''), kids: false }
      const locale: Locale = isLocale(pref.locale) ? pref.locale : 'en'
      const shared = await editionSnapshot(edition, locale)
      const built = await buildDigest({ userId: delivery.userId, profile, email: String(user.email), locale, edition, shared })
      if (built.composed.tiles < MIN_TILES) return { skip: 'thin' }
      if (!built.message) return { skip: 'no_token' }
      return { message: built.message }
    },
    reserve: reserveDigestSend,
    async transport(_delivery, message) {
      await bulkTransport().sendMail({ from: requireEmailEnv().from, ...message })
    },
    async onSent(delivery) {
      const prefs = await prefsOf
      await prefs.updateOne({ _id: delivery.profileId }, { $set: { last_edition: delivery.edition, hard_bounces: 0 } })
    },
    async onBounce(delivery) {
      const prefs = await prefsOf
      // Two hard bounces in a row pause it until the profile turns it back on.
      await prefs.updateOne({ _id: delivery.profileId }, [
        { $set: { hard_bounces: { $add: [{ $ifNull: ['$hard_bounces', 0] }, 1] } } },
        { $set: { paused_reason: { $cond: [{ $gte: ['$hard_bounces', 2] }, 'bounced', { $ifNull: ['$paused_reason', null] }] } } },
      ])
    },
  }
}

/** One call of the weekly digest job. */
export async function runWeeklyDigest({ deadline, now = new Date(), engine }: { deadline: number; now?: Date; engine?: SendEngine<DigestMessage> }): Promise<CronResult> {
  if (!digestConfigured()) return { status: 'idle', configured: false }
  const edition = editionFor(now)
  if (!isOpen(edition, now)) return closeEdition(edition)

  const { editions } = await digestCollections()
  await editions.updateOne({ _id: edition.id }, {
    $setOnInsert: {
      opens_at: edition.opensAt,
      closes_at: edition.closesAt,
      in_ramadan: edition.inRamadan,
      phase: 'snapshot',
      enqueue_cursor: null,
      shared: {},
      counts: {},
      created_at: now,
      expires_at: editionExpiry(now),
    },
  }, { upsert: true }).catch((error) => { if (!isDuplicateKey(error)) throw error })

  let phase = (await editions.findOne({ _id: edition.id }, { projection: { phase: 1 } }))?.phase
  if (phase === 'snapshot') {
    if (!(await snapshotPhase(edition, deadline))) return { more: true, snapshotting: true }
    phase = 'enqueue'
  }
  let enqueued = 0
  if (phase === 'enqueue') {
    const result = await enqueuePhase(edition, deadline)
    enqueued = result.enqueued
    if (!result.done) return { more: true, enqueued }
    phase = 'send'
  }
  if (phase !== 'send') return { status: 'idle' }

  const stats = await sendQueued(edition.id, deadline, engine ?? engineFor(edition))
  const left = await queuedCount(edition.id)
  const { quota, ...counts } = stats
  if (quota) return { status: 'quota', more: false, enqueued, ...counts, left }
  return { more: left > 0, enqueued, ...counts, left }
}
