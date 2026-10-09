// GET /api/digest/preview?locale=: the active profile's digest as it would go out now, as an HTML
// page. Settings shows it in a sandboxed iframe (srcDoc); opened directly, the CSP sandbox header
// keeps it inert (no scripts, no forms, no same-origin access). 12 previews an hour.
// The subject, the preheader and the number of titles ride in X-Digest-* headers.
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { requireGrownUpProfile } from '@/src/lib/profiles'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { getLocale } from '@/src/lib/i18n/server'
import { isLocale, type Locale } from '@/src/lib/i18n/locales'
import { digestCollections } from '@/src/lib/digest/db'
import { buildDigest, previewMaterial } from '@/src/lib/digest/build'
import { MIN_TILES } from '@/src/lib/digest/compose'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PREVIEW_CSP = [
  'sandbox',
  "default-src 'none'",
  'img-src https: data:',
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join('; ')

export async function GET(request: Request) {
  const owner = await requireGrownUpProfile()
  if ('error' in owner) return owner.error

  const limit = await rateLimit(`digest:preview:${owner.userId}`, 12, 3600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const asked = new URL(request.url).searchParams.get('locale')
  const { prefs, users } = await digestCollections()
  const [pref, user] = await Promise.all([
    prefs.findOne({ _id: owner.profile.id }, { projection: { locale: 1 } }),
    users.findOne({ _id: new ObjectId(owner.userId) }, { projection: { email: 1 } }),
  ])
  const locale: Locale = isLocale(asked) ? asked : pref && isLocale(pref.locale) ? pref.locale : getLocale()

  try {
    const { edition, week, shared } = await previewMaterial(locale)
    const { composed, rendered } = await buildDigest({
      userId: owner.userId,
      profile: owner.profile,
      email: String(user?.email ?? ''),
      locale,
      edition,
      week,
      shared,
    })
    return new NextResponse(rendered.html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': PREVIEW_CSP,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
        'X-Digest-Subject': encodeURIComponent(rendered.subject),
        'X-Digest-Preheader': encodeURIComponent(rendered.preheader),
        'X-Digest-Tiles': String(composed.tiles),
        'X-Digest-Thin': composed.tiles < MIN_TILES ? '1' : '0',
        'X-Digest-Bytes': String(Buffer.byteLength(rendered.html)),
      },
    })
  } catch (error) {
    console.error('Digest preview failed:', error)
    return NextResponse.json({ error: 'The preview could not be built', code: 'failed' }, { status: 500 })
  }
}
