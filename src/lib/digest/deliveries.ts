// Sending an edition's queued deliveries, at most once each.
//
// A delivery is claimed (queued -> building) by one atomic update, built, its mail budget taken,
// then moved to 'sending' by an update that only succeeds for the claim that holds it, and only
// then handed to SMTP. So:
// - two runs (or lanes) can never send the same delivery: only one claim wins each step;
// - a run killed while building leaves a 'building' row: after 5 minutes it goes back to queued
//   (nothing was sent yet);
// - a run killed while sending leaves a 'sending' row: after 5 minutes it becomes 'unknown' and is
//   never sent again (it may have gone out; a second copy is worse than a missing one).
import { randomUUID } from 'crypto'
import { digestCollections, type DeliveryDoc, type DeliveryStatus } from '@/src/lib/digest/db'

export const STALE_MS = 5 * 60 * 1000
/** Stop starting new sends when less than this is left before the deadline. */
export const SEND_RESERVE_MS = 4000
export const LANES = 3
/** A delivery that couldn't reach the mail server is retried at most this many times. */
const MAX_ATTEMPTS = 3

export type Prepared<M> = { skip: string } | { message: M }

export type SendEngine<M> = {
  /** Build the e-mail, or say why this one is skipped ('off', 'thin'...). */
  prepare: (delivery: DeliveryDoc) => Promise<Prepared<M>>
  /** Take one slot of today's budgets; false when they're spent (nothing is sent). */
  reserve: () => Promise<boolean>
  /** Hand it to SMTP; throws when the server refuses it or the connection fails. */
  transport: (delivery: DeliveryDoc, message: M) => Promise<void>
  /** After a send (resets the bounce count) and after a hard bounce (counts it). */
  onSent?: (delivery: DeliveryDoc) => Promise<void>
  onBounce?: (delivery: DeliveryDoc) => Promise<void>
}

export type SendStats = { sent: number; skipped: number; failed: number; unknown: number; retried: number; recovered: number; quota: boolean }

/** Rows left behind by a killed run: 'building' goes back to queued, 'sending' becomes 'unknown'. */
export async function recoverStale(edition: string, now: Date = new Date()) {
  const { deliveries, editions } = await digestCollections()
  const before = new Date(now.getTime() - STALE_MS)
  const requeued = await deliveries.updateMany(
    { edition, status: 'building', claimed_at: { $lt: before } },
    { $set: { status: 'queued', claim: null, updated_at: now } },
  )
  const lost = await deliveries.updateMany(
    { edition, status: 'sending', claimed_at: { $lt: before } },
    { $set: { status: 'unknown', claim: null, reason: 'interrupted', updated_at: now } },
  )
  if (lost.modifiedCount) await editions.updateOne({ _id: edition }, { $inc: { 'counts.unknown': lost.modifiedCount } })
  return { requeued: requeued.modifiedCount, unknown: lost.modifiedCount }
}

/** Takes the next queued delivery for `claim` (queued -> building), or null when none is left. */
export async function claimNext(edition: string, claim: string): Promise<DeliveryDoc | null> {
  const { deliveries } = await digestCollections()
  const now = new Date()
  // mongodb 5.x: the document is in `.value`.
  const result = await deliveries.findOneAndUpdate(
    { edition, status: 'queued' },
    { $set: { status: 'building', claim, claimed_at: now, updated_at: now }, $inc: { attempts: 1 } },
    { sort: { _id: 1 }, returnDocument: 'after' },
  )
  return result.value ?? null
}

/** building -> sending, only for the claim that holds it. */
export async function markSending(id: string, claim: string): Promise<boolean> {
  const { deliveries } = await digestCollections()
  const now = new Date()
  const result = await deliveries.updateOne({ _id: id, status: 'building', claim }, { $set: { status: 'sending', claimed_at: now, updated_at: now } })
  return result.modifiedCount === 1
}

/** The end of a claimed delivery (only by its claim). */
async function settle(delivery: DeliveryDoc, claim: string, status: DeliveryStatus, reason: string | null = null) {
  const { deliveries, editions } = await digestCollections()
  const now = new Date()
  const result = await deliveries.updateOne(
    { _id: delivery._id, claim },
    { $set: { status, reason, claim: null, updated_at: now, ...(status === 'sent' ? { sent_at: now } : {}) } },
  )
  if (result.modifiedCount === 1) await editions.updateOne({ _id: delivery.edition }, { $inc: { [`counts.${status}`]: 1 } })
  return result.modifiedCount === 1
}

/** Back in the queue, nothing sent (the budget ran out, or the mail server couldn't be reached). */
async function requeue(delivery: DeliveryDoc, claim: string, refund: boolean) {
  const { deliveries } = await digestCollections()
  await deliveries.updateOne(
    { _id: delivery._id, claim, status: { $in: ['building', 'sending'] } },
    { $set: { status: 'queued', claim: null, updated_at: new Date() }, ...(refund ? { $inc: { attempts: -1 } } : {}) },
  )
}

type SmtpError = { code?: string; responseCode?: number }

/** The server refused the recipient for good (5xx on RCPT TO): a hard bounce. */
const isHardBounce = (error: SmtpError) => error?.code === 'EENVELOPE' && (error.responseCode ?? 0) >= 500
/** Nothing reached the server (connection or login failed): safe to try again later. */
const neverReached = (error: SmtpError) => ['ECONNECTION', 'EAUTH', 'EDNS', 'ETLS'].includes(error?.code ?? '')
/** The server refused the message itself. */
const refused = (error: SmtpError) => (error?.code === 'EENVELOPE' || error?.code === 'EMESSAGE') && (error.responseCode ?? 0) >= 400

/**
 * Sends the edition's queued deliveries on LANES lanes until none is left, the deadline nears, or
 * a budget runs out (then everything left stays queued for the next run).
 */
export async function sendQueued<M>(edition: string, deadline: number, engine: SendEngine<M>, lanes = LANES): Promise<SendStats> {
  const stats: SendStats = { sent: 0, skipped: 0, failed: 0, unknown: 0, retried: 0, recovered: 0, quota: false }
  const recovered = await recoverStale(edition)
  stats.recovered = recovered.requeued
  stats.unknown += recovered.unknown
  const claim = randomUUID()
  const timeUp = () => Date.now() > deadline - SEND_RESERVE_MS

  const handle = async (delivery: DeliveryDoc) => {
    let prepared: Prepared<M>
    try {
      prepared = await engine.prepare(delivery)
    } catch (error) {
      console.error(`Digest ${delivery._id}: building failed`, error)
      if (delivery.attempts >= MAX_ATTEMPTS) {
        if (await settle(delivery, claim, 'failed', 'build')) stats.failed++
      } else {
        await requeue(delivery, claim, false)
        stats.retried++
      }
      return
    }
    if ('skip' in prepared) {
      if (await settle(delivery, claim, 'skipped', prepared.skip)) stats.skipped++
      return
    }
    if (!(await engine.reserve())) {
      stats.quota = true
      await requeue(delivery, claim, true)
      return
    }
    if (!(await markSending(delivery._id, claim))) return // taken over (stale recovery): never send twice
    try {
      await engine.transport(delivery, prepared.message)
    } catch (error) {
      const smtp = error as SmtpError
      if (isHardBounce(smtp)) {
        if (await settle(delivery, claim, 'failed', 'bounce')) stats.failed++
        await engine.onBounce?.(delivery).catch(() => {})
      } else if (neverReached(smtp) && delivery.attempts < MAX_ATTEMPTS) {
        await requeue(delivery, claim, false)
        stats.retried++
      } else if (refused(smtp) || neverReached(smtp)) {
        if (await settle(delivery, claim, 'failed', smtp.code ?? 'smtp')) stats.failed++
      } else {
        // It may or may not have gone out: never again.
        console.error(`Digest ${delivery._id}: sending ended unclear`, error)
        if (await settle(delivery, claim, 'unknown', 'smtp')) stats.unknown++
      }
      return
    }
    if (await settle(delivery, claim, 'sent')) stats.sent++
    await engine.onSent?.(delivery).catch(() => {})
  }

  await Promise.all(Array.from({ length: lanes }, async () => {
    while (!stats.quota && !timeUp()) {
      const delivery = await claimNext(edition, claim)
      if (!delivery) return
      await handle(delivery)
    }
  }))
  return stats
}

/** How many deliveries of an edition are still waiting to be sent. */
export async function queuedCount(edition: string) {
  const { deliveries } = await digestCollections()
  return deliveries.countDocuments({ edition, status: 'queued' })
}
