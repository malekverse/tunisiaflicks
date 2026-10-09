// The TV side of pairing (see src/lib/tv-pairing.ts).
// POST: a new code, 10 per 10 minutes per IP → {deviceCode, userCode, expiresAt, interval}.
// GET ?device=: how the pairing is going → {status: pending|approved|denied|used|expired}.
import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { createPairing, isDeviceCode, pairingStatus } from '@/src/lib/tv-pairing'
import { LOCALE_COOKIE, isLocale } from '@/src/lib/i18n/locales'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function POST(request: NextRequest) {
  const limit = await rateLimit(`tv-pair:ip:${clientIp(request.headers)}`, 10, 10 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value
  try {
    const pairing = await createPairing({
      userAgent: request.headers.get('user-agent'),
      locale: isLocale(cookieLocale) ? cookieLocale : 'en',
    })
    return NextResponse.json(
      { deviceCode: pairing.deviceCode, userCode: pairing.userCode, expiresAt: pairing.expiresAt.toISOString(), interval: 3 },
      { status: 201, headers: noStore },
    )
  } catch (error) {
    console.error('tv pair:', error)
    return NextResponse.json({ error: 'Could not start pairing' }, { status: 503, headers: noStore })
  }
}

export async function GET(request: NextRequest) {
  const device = request.nextUrl.searchParams.get('device')
  if (!isDeviceCode(device)) return NextResponse.json({ status: 'expired' }, { status: 404, headers: noStore })
  // Polling every 3 seconds for 10 minutes is 200 calls: room for that, not for scanning.
  const limit = await rateLimit(`tv-pair-poll:ip:${clientIp(request.headers)}`, 400, 10 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const { status, expiresAt } = await pairingStatus(device)
  return NextResponse.json(
    { status, expiresAt: expiresAt?.toISOString() ?? null },
    { status: status === 'expired' ? 404 : 200, headers: noStore },
  )
}
