// A new account says which friend invited it (lib/plus claimReferral): once, while it's new.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { claimReferral } from '@/src/lib/plus'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Body: { code }. Answers { result }: claimed, already, not_new, self or invalid. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const id = session?.user?.id
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limit = await rateLimit(`referral-claim:${id}`, 5, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)
  const body = await request.json().catch(() => null)
  const result = await claimReferral(id, String(body?.code ?? ''))
  return NextResponse.json({ result }, { headers: { 'Cache-Control': 'private, no-store' } })
}
