// Push notification subscriptions. Guests can subscribe too (the daily pick on an installed app);
// a signed-in device is linked to the account (release alerts) and bound to the profile in use on
// it (friends and movie nights, which Kids profiles never get).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { isLocale } from '@/src/lib/i18n'
import { getActiveProfile } from '@/src/lib/profiles'
import { clientIp, rateLimitAll, tooManyRequests } from '@/src/lib/rate-limit'
import { isValidSubscription, pushCollection, pushEnabled, pushPublicKey, subscriptionId, type PushTopic } from '@/src/lib/push'

export const dynamic = 'force-dynamic'

const TOPICS: PushTopic[] = ['pick', 'alerts', 'friends', 'nights']
/** Topics that belong to a grown-up profile, not to the device or the account. */
const PROFILE_TOPICS: PushTopic[] = ['friends', 'nights']

/** Per device (many people share one IP here), with a loose per-IP backstop. */
const limit = (endpoint: string, request: Request) => rateLimitAll([
  [`push:sub:${subscriptionId(endpoint)}`, 30, 60 * 60],
  [`push:ip:${clientIp(request.headers)}`, 300, 60 * 60],
])

/** Whether push is configured, the VAPID public key, and this device's current topics and profile. */
export async function GET(request: Request) {
  if (!pushEnabled()) return NextResponse.json({ enabled: false })
  const endpoint = new URL(request.url).searchParams.get('endpoint')
  let topics: PushTopic[] | null = null
  let profileId: string | null = null
  if (endpoint) {
    const doc = await (await pushCollection()).findOne({ _id: subscriptionId(endpoint) })
    topics = doc?.topics ?? null
    profileId = doc?.profileId ?? null
  }
  return NextResponse.json({ enabled: true, publicKey: pushPublicKey(), topics, profileId })
}

/** Subscribe (or update the topics of) this device. Body: { subscription, topics, locale }. */
export async function POST(request: Request) {
  if (!pushEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 503 })
  const body = await request.json().catch(() => null)
  if (!isValidSubscription(body?.subscription)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const { endpoint, keys } = body.subscription
  const limited = await limit(endpoint, request)
  if (!limited.ok) return tooManyRequests(limited.retryAfter)

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null
  const active = userId ? await getActiveProfile().catch(() => null) : null
  const profile = active?.profile ?? null
  const grownUp = !!profile && !profile.kids
  const asked = Array.isArray(body.topics) ? TOPICS.filter((topic) => body.topics.includes(topic)) : ['pick' as PushTopic]
  // Friends and nights need a grown-up profile on this device (and an account at all).
  const topics = asked.filter((topic) => grownUp || !PROFILE_TOPICS.includes(topic))

  const collection = await pushCollection()
  const _id = subscriptionId(endpoint)
  if (topics.length === 0) {
    await collection.deleteOne({ _id })
    return NextResponse.json({ ok: true, topics: [], profileId: null })
  }
  await collection.updateOne(
    { _id },
    {
      $set: {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        topics,
        locale: isLocale(body.locale) ? body.locale : 'en',
        userId,
        profileId: profile?.id ?? null,
        profileKids: profile?.kids === true,
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  )
  return NextResponse.json({ ok: true, topics, profileId: profile?.id ?? null })
}

/** Unsubscribe this device. Body: { endpoint }. */
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const limited = await limit(body.endpoint, request)
  if (!limited.ok) return tooManyRequests(limited.retryAfter)
  await (await pushCollection()).deleteOne({ _id: subscriptionId(body.endpoint) })
  return NextResponse.json({ ok: true })
}
