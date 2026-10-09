// Turns TV mode on or off on this device: POST {on: boolean}, JSON only (a form post from another
// site can't send JSON, so it can't flip the mode). The cookie is the same one /?tv=1|0 sets.
import { NextRequest, NextResponse } from 'next/server'
import { TV_COOKIE, TV_COOKIE_OPTIONS } from '@/src/lib/tv-mode'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Send JSON: {"on": true|false}' }, { status: 415 })
  }
  const body = await request.json().catch(() => null)
  if (typeof body?.on !== 'boolean') {
    return NextResponse.json({ error: 'Send JSON: {"on": true|false}' }, { status: 400 })
  }

  const response = NextResponse.json({ on: body.on }, { headers: { 'Cache-Control': 'no-store' } })
  if (body.on) {
    response.cookies.set(TV_COOKIE, '1', { ...TV_COOKIE_OPTIONS, secure: request.nextUrl.protocol === 'https:' })
  } else {
    response.cookies.delete(TV_COOKIE)
  }
  return response
}
