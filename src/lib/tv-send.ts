// "Play on my TV": a title sent from a phone or a computer to one of the account's TVs signed in with
// a code (lib/tv-sessions). It waits here a few minutes for that TV to pick it up (the TV app asks
// now and then while it's in use), then it's forgotten (TTL). One waiting title per TV: a new one
// replaces it. Nothing is kept once the TV has taken it.
//
// tvSends {_id: tvSessionId, userId, media, title, fromName, at, expireAt}
import 'server-only'
import clientPromise from '@/src/lib/mongodb'
import { isTvSessionId } from '@/src/lib/tv-sessions'
import type { Sent } from '@/src/lib/tv-send-rules'

export { cleanSentMedia, sentPath, type Sent, type SentMedia } from '@/src/lib/tv-send-rules'

export const SEND_MINUTES = 3

type SendDoc = Sent & { _id: string, userId: string, at: Date, expireAt: Date }

let ready: Promise<unknown> | null = null
async function collection() {
  const docs = (await clientPromise).db().collection<SendDoc>('tvSends')
  ready ??= Promise.all([
    docs.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    docs.createIndex({ userId: 1 }),
  ]).catch((error) => {
    ready = null
    console.error('tvSends: creating indexes failed', error)
  })
  await ready
  return docs
}

export async function sendToTv(userId: string, tvId: string, sent: Sent): Promise<void> {
  const at = new Date()
  await (await collection()).updateOne(
    { _id: tvId },
    { $set: { userId, ...sent, at, expireAt: new Date(at.getTime() + SEND_MINUTES * 60_000) } },
    { upsert: true },
  )
}

/** The title waiting for this TV, taken (so it opens once), or null. */
export async function takeForTv(tvId: string | undefined): Promise<Sent | null> {
  if (!isTvSessionId(tvId)) return null
  const { value } = await (await collection()).findOneAndDelete({ _id: tvId, expireAt: { $gt: new Date() } })
  return value ? { media: value.media, title: value.title, fromName: value.fromName } : null
}

export async function deleteTvSends(userId: string): Promise<void> {
  await (await collection()).deleteMany({ userId })
}
