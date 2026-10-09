// A soundtrack track's 30-second preview: GET /api/soundtrack/preview/{trackId} → 302 to a fresh
// link on Deezer's preview CDN (Deezer's links expire after minutes, so none is ever stored or
// cached). Kids profiles can't play tracks with explicit lyrics.
import { NextResponse } from 'next/server'
import { getKidsMode } from '@/src/lib/profiles'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { previewUrl } from '@/src/lib/deezer'

export const dynamic = 'force-dynamic'

const fail = (status: number, code: string) => NextResponse.json({ code }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: Request, { params }: { params: { track: string } }) {
  if (!/^[0-9]{1,12}$/.test(params.track ?? '')) return fail(400, 'invalid_track')
  const limit = await rateLimit(`soundtrack-preview:${clientIp(request.headers)}`, 400, 600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const [preview, kids] = await Promise.all([previewUrl(Number(params.track)), getKidsMode()])
  if (!preview) return fail(404, 'no_preview')
  if (kids && preview.explicit) return fail(403, 'explicit')
  return NextResponse.redirect(preview.url, { status: 302, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}
