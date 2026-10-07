// The signed-in account's profiles: list them (with the one active on this device) and create new ones.
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { getActiveProfile, newProfile, requireGrownUpProfile, toProfilesResponse } from '@/src/lib/profiles'
import { MAX_PROFILES, PROFILE_COLORS, cleanProfileName } from '@/src/lib/models/Profile'

export const dynamic = 'force-dynamic'

export async function GET() {
  const active = await getActiveProfile()
  if (!active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(toProfilesResponse(active), { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const result = await requireGrownUpProfile()
  if ('error' in result) return result.error
  const { userId, active } = result

  const body = await request.json().catch(() => null)
  const name = cleanProfileName(body?.name)
  if (!name) {
    return NextResponse.json({ error: 'Profile names need 1 to 20 characters' }, { status: 400 })
  }
  if (active.profiles.some((profile) => profile.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'You already have a profile with that name' }, { status: 400 })
  }
  const color = PROFILE_COLORS.includes(body?.color) ? body.color : PROFILE_COLORS[active.profiles.length % PROFILE_COLORS.length]
  const profile = newProfile(name, color, body?.kids === true)

  // The size condition makes the limit hold even for concurrent requests.
  const client = await clientPromise
  const update = await client.db().collection('users').updateOne(
    { _id: new ObjectId(userId), [`profiles.${MAX_PROFILES - 1}`]: { $exists: false } },
    { $push: { profiles: profile } } as any
  )
  if (update.modifiedCount === 0) {
    return NextResponse.json({ error: `An account can have up to ${MAX_PROFILES} profiles` }, { status: 400 })
  }

  const { createdAt, ...created } = profile
  return NextResponse.json({ profile: created }, { status: 201 })
}
