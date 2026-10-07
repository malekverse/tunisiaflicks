import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { exportUserData } from '@/src/lib/account'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** "Download my data": everything we store about the signed-in user, as a JSON file. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await rateLimit(`export:user:${session.user.id}`, 5, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const data = await exportUserData(session.user.id)
  const day = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="tunisiaflicks-data-${day}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
