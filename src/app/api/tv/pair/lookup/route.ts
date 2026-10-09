// The phone looks up the code shown on a TV: GET ?code= → {deviceLabel, requestedMinutesAgo}.
// Needs a signed-in grown-up on a full session (../../guard.ts); 10 per 10 minutes per account and
// 20 per IP. Every lookup counts, and the 5th burns the code (410).
import { NextRequest, NextResponse } from 'next/server'
import { lookupPairing, normalizeUserCode } from '@/src/lib/tv-pairing'
import { json, phoneGate } from '../../guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const gate = await phoneGate(request, 'lookup')
  if ('error' in gate) return gate.error

  const code = normalizeUserCode(request.nextUrl.searchParams.get('code'))
  if (!code) return json(404, 'not_found', 'No TV is waiting with this code')

  const result = await lookupPairing(code)
  if ('reason' in result) {
    return result.reason === 'burned'
      ? json(410, 'burned', 'This code was checked too many times')
      : json(404, 'not_found', 'No TV is waiting with this code')
  }
  return NextResponse.json(
    { code, deviceLabel: result.deviceLabel, requestedMinutesAgo: result.requestedMinutesAgo },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
