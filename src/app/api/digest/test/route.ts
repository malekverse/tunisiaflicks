// POST /api/digest/test { locale? }: "Send it to me". The active profile's digest as it would go
// out now, to the account's (confirmed) address, its subject starting with '[Preview] '.
// Two a day, and it counts against the day's mail budgets like any digest.
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireGrownUpProfile } from '@/src/lib/profiles'
import { denyLimitedSession } from '@/src/lib/session-scope'
import { rateLimit } from '@/src/lib/rate-limit'
import { getLocale } from '@/src/lib/i18n/server'
import { isLocale, type Locale } from '@/src/lib/i18n/locales'
import { bulkTransport, requireEmailEnv } from '@/src/lib/email'
import { digestCollections } from '@/src/lib/digest/db'
import { buildDigest, digestConfigured, previewMaterial, reserveDigestSend } from '@/src/lib/digest/build'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const fail = (status: number, code: string, error: string, headers?: Record<string, string>) =>
  NextResponse.json({ error, code }, { status, headers })

export async function POST(request: Request) {
  const denied = await denyLimitedSession()
  if (denied) return denied
  const owner = await requireGrownUpProfile()
  if ('error' in owner) return owner.error
  if (!digestConfigured()) return fail(503, 'unavailable', 'The weekly digest is not available')

  const { prefs, users } = await digestCollections()
  const [pref, user] = await Promise.all([
    prefs.findOne({ _id: owner.profile.id }, { projection: { locale: 1 } }),
    users.findOne({ _id: new ObjectId(owner.userId) }, { projection: { email: 1, emailVerified: 1 } }),
  ])
  if (!user?.email || !user.emailVerified) return fail(409, 'unverified', 'Confirm your e-mail address first')

  const limit = await rateLimit(`digest:test:${owner.userId}`, 2, 86400)
  if (!limit.ok) return fail(429, 'limit', 'Two test e-mails a day', { 'Retry-After': String(Math.max(1, limit.retryAfter)) })

  const body = await request.json().catch(() => ({}))
  const locale: Locale = isLocale(body?.locale) ? body.locale : pref && isLocale(pref.locale) ? pref.locale : getLocale()

  try {
    const { edition, week, shared } = await previewMaterial(locale)
    const { message } = await buildDigest({ userId: owner.userId, profile: owner.profile, email: String(user.email), locale, edition, week, shared })
    if (!message) return fail(503, 'unavailable', 'The weekly digest is not available')
    if (!(await reserveDigestSend())) return fail(429, 'quota', 'The day’s e-mail budget is spent')
    await bulkTransport().sendMail({ from: requireEmailEnv().from, ...message, subject: `[Preview] ${message.subject}` })
    return NextResponse.json({ ok: true, email: String(user.email) })
  } catch (error) {
    console.error('Digest test send failed:', error)
    return fail(502, 'failed', 'The test e-mail could not be sent')
  }
}
