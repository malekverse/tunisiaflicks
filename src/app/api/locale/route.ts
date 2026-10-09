// POST /api/locale { locale, endpoint? }: the UI language a browser just switched to (see
// src/lib/i18n/sync-locale.ts). The tf-locale cookie already decides how pages render; this keeps
// the account (`users.locale`, for e-mails) and this device's push subscription
// (`pushSubscriptions.locale`, for notifications) in the same language.
//
// 200 { ok: true } once validated (saving is best effort), 400 for a bad body, 415 for anything
// but JSON, 429 after 30 calls an hour from one IP.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { ObjectId } from 'mongodb'
import { authOptions } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { isLocale } from '@/src/lib/i18n/locales'
import { isLimitedSession } from '@/src/lib/session-scope'
import { pushCollection, subscriptionId } from '@/src/lib/push'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

const MAX_ENDPOINT = 2048

/** A push service endpoint: an https URL of a sane length. */
function validEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ENDPOINT) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const bad = () => NextResponse.json({ error: 'invalid' }, { status: 400 })

export async function POST(request: Request) {
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415 })

  const limit = await rateLimit(`locale:ip:${clientIp(request.headers)}`, 30, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || !isLocale(body.locale)) return bad()
  const endpoint = body.endpoint ?? undefined
  if (endpoint !== undefined && !validEndpoint(endpoint)) return bad()
  const { locale } = body

  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const saves: Promise<unknown>[] = []
    // A TV signed in with a code doesn't change the account, only its own device.
    if (userId && ObjectId.isValid(userId) && !isLimitedSession(session)) {
      saves.push((await clientPromise).db().collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { locale } }))
    }
    // Only an existing subscription: this never creates one.
    if (endpoint) saves.push((await pushCollection()).updateOne({ _id: subscriptionId(endpoint) }, { $set: { locale } }))
    await Promise.all(saves)
  } catch (error) {
    console.error('Saving the UI language failed:', error)
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
