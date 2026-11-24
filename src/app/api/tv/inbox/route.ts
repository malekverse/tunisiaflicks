// "Play on my TV" (lib/tv-send), the TV's side: GET → {sent: {media, title, fromName, path}} the
// title waiting for this TV (taken: it opens once), or {sent: null}. Only for a TV signed in with a
// code: the token says which one.
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { sentPath, takeForTv } from '@/src/lib/tv-send'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.scope !== 'tv' || typeof token.pairingId !== 'string') return NextResponse.json({ sent: null }, { headers: noStore })
  const sent = await takeForTv(token.pairingId)
  return NextResponse.json({ sent: sent ? { ...sent, path: sentPath(sent.media) } : null }, { headers: noStore })
}
