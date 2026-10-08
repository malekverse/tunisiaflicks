// The active profile's weekly digest settings, and the account's release-e-mail switch.
//   GET -> { available, locked, enabled, email, emailVerified, locale, pausedReason, releaseAlerts, next }
//   PUT { enabled?, locale?, releaseAlerts? } -> the same, after the change (grown-up profiles only)
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { authOptions } from '@/src/lib/auth'
import { requireActiveProfile, requireGrownUpProfile } from '@/src/lib/profiles'
import { denyLimitedSession, isLimitedSession } from '@/src/lib/session-scope'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { getLocale } from '@/src/lib/i18n/server'
import { isLocale } from '@/src/lib/i18n/locales'
import { digestState, updateDigest } from '@/src/lib/digest/state'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

const Change = z.object({
  enabled: z.boolean().optional(),
  locale: z.string().refine(isLocale, 'Unknown language').optional(),
  releaseAlerts: z.boolean().optional(),
}).strict().refine((change) => Object.keys(change).length > 0, 'Nothing to change')

export async function GET() {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner.error
  const session = await getServerSession(authOptions)
  const state = await digestState({ userId: owner.userId, profile: owner.profile, limited: isLimitedSession(session), fallbackLocale: getLocale() })
  return NextResponse.json(state, { headers: NO_STORE })
}

export async function PUT(request: Request) {
  const denied = await denyLimitedSession()
  if (denied) return denied
  const owner = await requireGrownUpProfile()
  if ('error' in owner) return owner.error

  const limit = await rateLimit(`digest:put:${owner.userId}`, 30, 3600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const parsed = Change.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', code: 'invalid' }, { status: 400 })
  const change = { ...parsed.data, locale: parsed.data.locale as ReturnType<typeof getLocale> | undefined }

  const fallbackLocale = getLocale()
  const result = await updateDigest({ userId: owner.userId, profile: owner.profile, change, fallbackLocale })
  if ('error' in result) {
    return result.error === 'unverified'
      ? NextResponse.json({ error: 'Confirm your e-mail address first', code: 'unverified' }, { status: 409 })
      : NextResponse.json({ error: 'The weekly digest is not available', code: 'unavailable' }, { status: 503 })
  }
  const state = await digestState({ userId: owner.userId, profile: owner.profile, limited: false, fallbackLocale })
  return NextResponse.json(state, { headers: NO_STORE })
}
