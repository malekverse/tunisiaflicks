import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { ObjectId } from 'mongodb'
import { authOptions } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { startEmailVerification } from '@/src/lib/verification'

export const dynamic = 'force-dynamic'

/** Sends a new verification link to the signed-in user's email. */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await rateLimit(`verify-resend:user:${session.user.id}`, 3, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const users = (await clientPromise).db().collection('users')
  const user = await users.findOne({ _id: new ObjectId(session.user.id) }, { projection: { email: 1, emailVerified: 1 } })
  if (!user?.email) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true })

  const sent = await startEmailVerification(user._id, user.email)
  return sent
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Could not send the email' }, { status: 502 })
}
