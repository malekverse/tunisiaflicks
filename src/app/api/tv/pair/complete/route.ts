// Right after a TV signs in with 'tv-pair': puts the TV on the profile the phone approved, by
// setting the profile cookie here on the server. The TV never picks its own profile.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/src/lib/auth'
import { PROFILE_COOKIE } from '@/src/lib/models/Profile'
import { loadProfiles, profileCookieOptions } from '@/src/lib/profiles'
import { isLimitedSession } from '@/src/lib/session-scope'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isLimitedSession(session) || !session.pinnedProfileId) {
    return NextResponse.json({ error: 'Only for a TV signed in with a code', code: 'not_tv' }, { status: 403 })
  }
  const profiles = await loadProfiles(session.user.id)
  const profile = profiles.find((item) => item.id === session.pinnedProfileId)
  if (!profile) return NextResponse.json({ error: 'This profile no longer exists', code: 'profile' }, { status: 409 })

  const response = NextResponse.json({ profile: { id: profile.id, name: profile.name, kids: profile.kids } }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(PROFILE_COOKIE, profile.id, profileCookieOptions)
  return response
}
