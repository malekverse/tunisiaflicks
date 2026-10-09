// Unsubscribing from the weekly digest with the signed link in the e-mail (no sign-in needed).
//
// POST /api/unsubscribe?t=TOKEN
//   - from the inbox's own "Unsubscribe" button (RFC 8058 one-click, body List-Unsubscribe=One-Click):
//     200, off;
//   - from the /unsubscribe page's forms (t and do=off|on in the body): 303 back to the page with
//     the result, so the page works without JavaScript.
// GET /api/unsubscribe?t= never changes anything: 303 to the page, which asks first.
//
// The signature is checked before anything else. A valid token is never rate-limited (an inbox may
// retry, many people share one address); only invalid attempts are, 60 an hour per IP. Idempotent.
import { NextResponse } from 'next/server'
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from '@/src/lib/rate-limit'
import { verifyUnsubscribeToken } from '@/src/lib/digest/token'
import { resubscribeProfile, unsubscribeProfile } from '@/src/lib/digest/state'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

const pageUrl = (request: Request, token: string, state?: string) => {
  const url = new URL('/unsubscribe', request.url)
  if (token) url.searchParams.set('t', token)
  if (state) url.searchParams.set('s', state)
  return url
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? ''
  return NextResponse.redirect(pageUrl(request, token.slice(0, 200)), { status: 303, headers: NO_STORE })
}

export async function POST(request: Request) {
  const query = new URL(request.url).searchParams
  let form: FormData | null = null
  try {
    form = await request.formData()
  } catch {
    form = null // one-click bodies may be empty or not form-encoded; the token is in the URL
  }
  const token = String(form?.get('t') ?? query.get('t') ?? '').slice(0, 200)
  const action = form?.get('do')
  const fromPage = action === 'off' || action === 'on'

  const profileId = verifyUnsubscribeToken(token)
  if (!profileId) {
    const limit = await rateLimit(`unsub:bad:${clientIp(request.headers)}`, 60, 3600)
    if (fromPage) return NextResponse.redirect(pageUrl(request, token, limit.ok ? 'invalid' : 'limited'), { status: 303, headers: NO_STORE })
    return limit.ok
      ? NextResponse.json({ ok: false, error: 'Invalid link' }, { status: 400, headers: NO_STORE })
      : NextResponse.json({ ok: false, error: TOO_MANY_ATTEMPTS }, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(Math.max(1, limit.retryAfter)) } })
  }

  if (action === 'on') {
    const back = await resubscribeProfile(profileId)
    return NextResponse.redirect(pageUrl(request, token, back ? 'on' : undefined), { status: 303, headers: NO_STORE })
  }

  await unsubscribeProfile(profileId)
  if (fromPage) return NextResponse.redirect(pageUrl(request, token, 'done'), { status: 303, headers: NO_STORE })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
