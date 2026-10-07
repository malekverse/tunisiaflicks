// Picks the profile used on this device (POST) or forgets the pick (DELETE, used on sign-out).
// Only the session user's own profiles can be picked, and leaving Kids needs the account password.
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { compare } from 'bcrypt'
import clientPromise from '@/src/lib/mongodb'
import { canSwitchFreely, getActiveProfile, profileCookieOptions } from '@/src/lib/profiles'
import { PROFILE_COOKIE, isProfileId } from '@/src/lib/models/Profile'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const active = await getActiveProfile()
  if (!active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const target = isProfileId(body?.profileId) ? active.profiles.find((profile) => profile.id === body.profileId) : undefined
  if (!target) {
    return NextResponse.json({ error: 'This profile does not belong to your account' }, { status: 403 })
  }

  if (!target.kids && !canSwitchFreely(active)) {
    const password = typeof body?.password === 'string' ? body.password : ''
    const client = await clientPromise
    const user = await client.db().collection('users').findOne({ _id: new ObjectId(active.userId) }, { projection: { password: 1 } })
    if (!password || !user?.password || !(await compare(password, user.password))) {
      return NextResponse.json(
        { error: password ? 'Wrong password' : 'Enter the account password to leave the Kids profile', needsPassword: true },
        { status: 403 }
      )
    }
  }

  const response = NextResponse.json({ success: true, profile: target })
  response.cookies.set(PROFILE_COOKIE, target.id, profileCookieOptions)
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(PROFILE_COOKIE)
  return response
}
