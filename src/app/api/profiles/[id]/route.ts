// Rename / recolour / Kids toggle (PATCH) and delete (DELETE) one of the signed-in account's profiles.
// The id is only ever matched inside the session user's own document, so foreign ids simply 404.
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { requireGrownUpProfile } from '@/src/lib/profiles'
import { PROFILE_COLORS, PROFILE_COOKIE, cleanProfileName, isProfileId } from '@/src/lib/models/Profile'
import { denyLimitedSession } from '@/src/lib/session-scope'
import { deleteSocialProfile, resetSocialVisibility } from '@/src/lib/social/account'
import { deleteDigestPrefs } from '@/src/lib/digest/db'
import { onProfileRemovedFromLists } from '@/src/lib/shared-lists/account'
import { forgetProfileInNights } from '@/src/lib/movie-night'
import { deleteBadgeData } from '@/src/lib/badges/view'
import { revokeTvSessionsForProfile } from '@/src/lib/tv-sessions'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// A TV signed in with a code uses its one profile and never manages them (403 {code:'tv_session'}).

export async function PATCH(request: NextRequest, { params }: Params) {
  const denied = await denyLimitedSession()
  if (denied) return denied

  const result = await requireGrownUpProfile()
  if ('error' in result) return result.error
  const { userId, active } = result

  const target = isProfileId(params.id) ? active.profiles.find((profile) => profile.id === params.id) : undefined
  if (!target) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const set: Record<string, unknown> = {}
  if (body?.name !== undefined) {
    const name = cleanProfileName(body.name)
    if (!name) return NextResponse.json({ error: 'Profile names need 1 to 20 characters' }, { status: 400 })
    if (active.profiles.some((profile) => profile.id !== target.id && profile.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'You already have a profile with that name' }, { status: 400 })
    }
    set['profiles.$.name'] = name
  }
  if (body?.color !== undefined) {
    if (!PROFILE_COLORS.includes(body.color)) return NextResponse.json({ error: 'Invalid colour' }, { status: 400 })
    set['profiles.$.color'] = body.color
  }
  if (body?.kids !== undefined) {
    if (typeof body.kids !== 'boolean') return NextResponse.json({ error: 'Invalid Kids setting' }, { status: 400 })
    // Someone must always be able to manage the account.
    if (body.kids && !active.profiles.some((profile) => profile.id !== target.id && !profile.kids)) {
      return NextResponse.json({ error: 'Keep at least one grown-up profile' }, { status: 400 })
    }
    // A Kids profile has no page: its page must be deleted first.
    if (body.kids && !target.kids) {
      const page = await (await clientPromise).db().collection('socialProfiles').findOne({ _id: target.id as any }, { projection: { _id: 1 } })
      if (page) return NextResponse.json({ error: "A profile with a page can't become a Kids profile. Delete the page first.", code: 'kidsHasHandle' }, { status: 400 })
    }
    set['profiles.$.kids'] = body.kids
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const client = await clientPromise
  await client.db().collection('users').updateOne({ _id: new ObjectId(userId), 'profiles.id': target.id }, { $set: set })
  // Whoever the profile now is, nothing it shared before keeps showing.
  if (body?.kids !== undefined && body.kids !== !!target.kids) await resetSocialVisibility(target.id)
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const denied = await denyLimitedSession()
  if (denied) return denied

  const result = await requireGrownUpProfile()
  if ('error' in result) return result.error
  const { userId, active } = result

  const target = isProfileId(params.id) ? active.profiles.find((profile) => profile.id === params.id) : undefined
  if (!target) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (!active.profiles.some((profile) => profile.id !== target.id && !profile.kids)) {
    return NextResponse.json({ error: 'Keep at least one grown-up profile' }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $pull: { profiles: { id: target.id } } } as any
  )
  // The profile's favorites, bookmarks and history go with it.
  await db.collection('userContent').deleteMany({ userId, profileId: target.id })
  // Its page, friendships, ratings and invites, and its weekly digest.
  // In this order: shared lists and movie nights still read the profile's page and name.
  await onProfileRemovedFromLists(userId, target.id)
  await forgetProfileInNights(userId, target.id)
  await deleteSocialProfile({ userId, profileId: target.id })
  await deleteDigestPrefs(target.id)
  await deleteBadgeData(userId, target.id)
  await revokeTvSessionsForProfile(userId, target.id)

  const response = NextResponse.json({ success: true })
  if (active.profile?.id === target.id) response.cookies.delete(PROFILE_COOKIE)
  return response
}
