// Screen time's minutes watched (lib/screen-time has the rules): one small document per Kids
// profile and day, forgotten after a few days (TTL). Nothing else about the watching is kept.
//
// screenTime {_id: "profileId:YYYY-MM-DD", userId, profileId, day, minutes, expireAt}
import 'server-only'
import clientPromise from '@/src/lib/mongodb'
import { MAX_REPORT } from '@/src/lib/screen-time'

type ScreenDoc = { _id: string, userId: string, profileId: string, day: string, minutes: number, expireAt: Date }

let ready: Promise<unknown> | null = null
async function collection() {
  const docs = (await clientPromise).db().collection<ScreenDoc>('screenTime')
  ready ??= Promise.all([
    docs.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    docs.createIndex({ userId: 1 }),
  ]).catch((error) => {
    ready = null
    console.error('screenTime: creating indexes failed', error)
  })
  await ready
  return docs
}

export async function minutesUsed(profileId: string, day: string): Promise<number> {
  const doc = await (await collection()).findOne({ _id: `${profileId}:${day}` }, { projection: { minutes: 1 } })
  return Math.max(0, Number(doc?.minutes) || 0)
}

/** Adds what a page watched (at most MAX_REPORT minutes a report); the day's total back. */
export async function addMinutes(userId: string, profileId: string, day: string, minutes: number): Promise<number> {
  const add = Math.max(0, Math.min(MAX_REPORT, Math.round(minutes)))
  const docs = await collection()
  // The 5.9 driver answers {value}.
  const { value: doc } = await docs.findOneAndUpdate(
    { _id: `${profileId}:${day}` },
    {
      $inc: { minutes: add },
      $setOnInsert: { userId, profileId, day, expireAt: new Date(Date.now() + 4 * 86400_000) },
    },
    { upsert: true, returnDocument: 'after' },
  )
  return Math.min(1440, Number(doc?.minutes) || add)
}

/** A profile or an account going away. */
export async function deleteScreenTime(userId: string, profileId?: string): Promise<void> {
  await (await collection()).deleteMany(profileId ? { userId, profileId } : { userId })
}
