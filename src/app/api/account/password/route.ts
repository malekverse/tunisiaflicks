import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { ObjectId } from 'mongodb'
import { compare, hash } from 'bcrypt'
import { authOptions } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Change the password (current one required), or set a first one on a Google-only account. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await rateLimit(`password:user:${session.user.id}`, 5, 15 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const body = await request.json().catch(() => ({}))
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (newPassword.length < 8 || newPassword.length > 200) {
    return NextResponse.json({ error: 'weak', message: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const users = (await clientPromise).db().collection('users')
  const _id = new ObjectId(session.user.id)
  const user = await users.findOne({ _id }, { projection: { password: 1 } })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Accounts that already have a password must prove they know it.
  if (typeof user.password === 'string' && user.password) {
    if (!currentPassword || !(await compare(currentPassword, user.password))) {
      return NextResponse.json({ error: 'wrongPassword' }, { status: 400 })
    }
  }

  await users.updateOne(
    { _id },
    { $set: { password: await hash(newPassword, 10), updatedAt: new Date() }, $unset: { resetToken: '', resetTokenExpiry: '' } }
  )
  return NextResponse.json({ ok: true })
}
