// The evening "Pick of the day" push, without a cron job: from 18:00 (Tunis) the site's own
// visitors trigger it (see DailyPushTrigger). A short lease in MongoDB makes sure only one request
// works at a time, and each device is marked before it is sent to, so nobody gets it twice and a
// run cut short is simply continued by the next visitor.
import clientPromise from '@/src/lib/mongodb'
import { createTranslator, type Locale } from '@/src/lib/i18n'
import { getPickOfTheDay, tunisToday } from '@/src/lib/pick-of-the-day'
import { pushCollection, pushEnabled, sendPushToAll, type PushPayload } from '@/src/lib/push'
import { TMDB_IMAGE_BASE } from '@/src/lib/tmdb-image'

/** Local (Tunis) hour from which the pick goes out. */
export const PICK_PUSH_HOUR = 18
const LEASE_MS = 60_000
const BATCH = 300

export const tunisHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))

type Lease = { _id: string, lease_until: Date }

async function claimLease(now: Date): Promise<boolean> {
  const jobs = (await clientPromise).db().collection<Lease>('jobs')
  try {
    const result = await jobs.updateOne(
      { _id: 'pick-push', lease_until: { $lt: now } },
      { $set: { lease_until: new Date(now.getTime() + LEASE_MS) } },
      { upsert: true },
    )
    return result.modifiedCount + result.upsertedCount > 0
  } catch (error: any) {
    if (error?.code === 11000) return false // someone else holds it (the upsert raced an existing doc)
    throw error
  }
}

async function releaseLease() {
  const jobs = (await clientPromise).db().collection<Lease>('jobs')
  await jobs.updateOne({ _id: 'pick-push' }, { $set: { lease_until: new Date(0) } })
}

export async function runDailyPickPush({ deadline = Date.now() + 20_000, force = false } = {}) {
  if (!pushEnabled()) return { status: 'disabled' as const }
  if (!force && tunisHour() < PICK_PUSH_HOUR) return { status: 'too-early' as const }

  const date = tunisToday()
  const collection = await pushCollection()
  const pending = { topics: 'pick' as const, pick_sent_on: { $ne: date } }
  // Cheap early exit for the (vast majority of) requests after today's run is done.
  if (!(await collection.findOne(pending, { projection: { _id: 1 } }))) return { status: 'done' as const }

  const now = new Date()
  if (!(await claimLease(now))) return { status: 'busy' as const }
  try {
    const docs = await collection.find(pending).limit(BATCH).toArray()
    // Mark first: a crash after this point loses one notification rather than sending it twice.
    await collection.updateMany({ _id: { $in: docs.map((doc) => doc._id) } }, { $set: { pick_sent_on: date } })

    const payloads = new Map<Locale, PushPayload | null>()
    for (const locale of new Set(docs.map((doc) => doc.locale))) {
      const pick = await getPickOfTheDay(false, locale, date)
      if (!pick) { payloads.set(locale, null); continue }
      const t = createTranslator(locale)
      const title = pick.data.title || pick.data.name || ''
      // Why it's today's pick says more than a tagline.
      const text: string = pick.why || pick.data.tagline || pick.data.overview || ''
      payloads.set(locale, {
        title: t('push.pickTitle', { title }),
        body: text.length > 140 ? `${text.slice(0, 137)}…` : text,
        url: `/${pick.kind}/${pick.data.id}`,
        image: pick.data.backdrop_path ? `${TMDB_IMAGE_BASE}/w780${pick.data.backdrop_path}` : undefined,
        tag: 'pick-of-the-day',
      })
    }
    const ready = docs.filter((doc) => payloads.get(doc.locale))
    const stats = await sendPushToAll(ready, (doc) => payloads.get(doc.locale)!, deadline)
    // Out of time, or no pick for that language (TMDB down): the next visitor's request retries them.
    const retry = [...stats.skipped, ...docs.filter((doc) => !payloads.get(doc.locale)).map((doc) => doc._id)]
    if (retry.length) await collection.updateMany({ _id: { $in: retry } }, { $unset: { pick_sent_on: '' } })
    return { status: 'sent' as const, sent: stats.sent, failed: stats.failed, retry: retry.length }
  } finally {
    await releaseLease()
  }
}
