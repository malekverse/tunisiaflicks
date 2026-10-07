// Push notification subscriptions. Guests can subscribe too (the daily pick on an installed app);
// a signed-in device is linked to the account so it also gets the account's release alerts.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { isLocale } from '@/src/lib/i18n'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { isValidSubscription, pushCollection, pushEnabled, pushPublicKey, subscriptionId, type PushTopic } from '@/src/lib/push'

export const dynamic = 'force-dynamic'

const TOPICS: PushTopic[] = ['pick', 'alerts']

/** Whether push is configured, the VAPID public key, and this device's current topics. */
export async function GET(request: Request) {
  if (!pushEnabled()) return NextResponse.json({ enabled: false })
  const endpoint = new URL(request.url).searchParams.get('endpoint')
  let topics: PushTopic[] | null = null
  if (endpoint) {
    const doc = await (await pushCollection()).findOne({ _id: subscriptionId(endpoint) })
    topics = doc?.topics ?? null
  }
  return NextResponse.json({ enabled: true, publicKey: pushPublicKey(), topics })
}

/** Subscribe (or update the topics of) this device. Body: { subscription, topics, locale }. */
export async function POST(request: Request) {
  if (!pushEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 503 })
  const limit = await rateLimit(`push:ip:${clientIp(request.headers)}`, 30, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const body = await request.json().catch(() => null)
  if (!isValidSubscription(body?.subscription)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const topics = Array.isArray(body.topics) ? TOPICS.filter((topic) => body.topics.includes(topic)) : ['pick' as PushTopic]
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null
  const { endpoint, keys } = body.subscription

  const collection = await pushCollection()
  const _id = subscriptionId(endpoint)
  if (topics.length === 0) {
    await collection.deleteOne({ _id })
    return NextResponse.json({ ok: true, topics: [] })
  }
  await collection.updateOne(
    { _id },
    {
      $set: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, topics, locale: isLocale(body.locale) ? body.locale : 'en', userId },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  )
  return NextResponse.json({ ok: true, topics })
}

/** Unsubscribe this device. Body: { endpoint }. */
export async function DELETE(request: Request) {
  const limit = await rateLimit(`push:ip:${clientIp(request.headers)}`, 30, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'invalid' }, { status: 400 })
  await (await pushCollection()).deleteOne({ _id: subscriptionId(body.endpoint) })
  return NextResponse.json({ ok: true })
}
