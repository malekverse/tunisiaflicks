import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { ObjectId } from 'mongodb'
import { compare } from 'bcrypt'
import { authOptions } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { deleteUserData } from '@/src/lib/account'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { denyLimitedSession } from '@/src/lib/session-scope'

export const dynamic = 'force-dynamic'

/**
 * Permanently delete the signed-in account. Confirmed with the password, or (accounts without
 * one, e.g. Google-only) by typing the account's email. Never from a TV session.
 */
export async function DELETE(request: Request) {
  const denied = await denyLimitedSession()
  if (denied) return denied

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await rateLimit(`delete:user:${session.user.id}`, 5, 15 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const body = await request.json().catch(() => ({}))
  const users = (await clientPromise).db().collection('users')
  const user = await users.findOne({ _id: new ObjectId(session.user.id) }, { projection: { password: 1, email: 1 } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasPassword = typeof user.password === 'string' && user.password.length > 0
  const confirmed = hasPassword
    ? typeof body.password === 'string' && await compare(body.password, user.password)
    : typeof body.email === 'string' && body.email.trim().toLowerCase() === String(user.email ?? '').toLowerCase()
  if (!confirmed) return NextResponse.json({ error: 'notConfirmed' }, { status: 400 })

  await deleteUserData(session.user.id)
  return NextResponse.json({ ok: true })
}
