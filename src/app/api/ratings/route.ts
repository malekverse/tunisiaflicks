// Ratings of a title: yours, your friends' (as far as they share), and the TunisiaFlicks average.
// GET is open to guests (mine: null); PUT and DELETE need a profile (Kids and TVs may rate too).
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { notify } from '@/src/lib/notify'
import { getActiveProfile, requireActiveProfile } from '@/src/lib/profiles'
import { socialDb } from '@/src/lib/social/db'
import { getFriends } from '@/src/lib/social/friends'
import { mediaHref, resolveShareMedia } from '@/src/lib/social/media'
import { normalizePrivacy } from '@/src/lib/social/privacy'
import { UnknownTitleError, clearRating, friendsRatings, getMyRating, ratingSummary, setRating } from '@/src/lib/social/ratings'
import { loadSocialProfile, readJson, socialError, socialJson, socialRateLimit } from '@/src/lib/social/session'
import { isLimitedSession } from '@/src/lib/session-scope'
import type { ProfileRef } from '@/src/lib/social/types'

export const dynamic = 'force-dynamic'

function parseTitle(type: unknown, id: unknown): { media_type: 'movie' | 'tv'; tmdbId: string } | null {
  const mediaType: 'movie' | 'tv' | null = type === 'movie' || type === 'tv' ? type : null
  const tmdbId = typeof id === 'number' ? String(id) : typeof id === 'string' && /^[0-9]{1,9}$/.test(id) ? id : null
  return mediaType && tmdbId ? { media_type: mediaType, tmdbId: String(Number(tmdbId)) } : null
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const title = parseTitle(params.get('type'), params.get('id'))
  if (!title) return socialError(400, 'invalid')
  const [session, active] = await Promise.all([getServerSession(authOptions), getActiveProfile()])
  const profile = active?.profile ?? null
  const ref: ProfileRef | null = profile && active ? { userId: active.userId, profileId: profile.id } : null
  const social = ref && !profile?.kids && !isLimitedSession(session) ? await loadSocialProfile(ref.profileId) : null

  const [mine, friends, summary] = await Promise.all([
    ref ? getMyRating(ref, title.media_type, title.tmdbId) : null,
    ref && social ? friendsRatings(ref, title.media_type, title.tmdbId) : [],
    ratingSummary(title.media_type, title.tmdbId),
  ])
  return socialJson({ mine, friends, average: summary.average, countLabel: summary.countLabel })
}

/** Friends who saved this title hear about a good rating (4 stars and up), when ratings reach friends. */
async function tellFriends(ref: ProfileRef, media_type: 'movie' | 'tv', tmdbId: string, stars: number) {
  const page = await loadSocialProfile(ref.profileId)
  if (!page) return
  const privacy = normalizePrivacy(page.privacy)
  if (privacy.paused || privacy.ratings === 'private') return
  const friends = (await getFriends(ref.profileId)).slice(0, 200)
  if (friends.length === 0) return
  const { userContent } = await socialDb()
  const savers = await userContent.find(
    {
      type: 'saved',
      profileId: { $in: friends.map((friend) => friend.profileId) },
      items: { $elemMatch: { id: { $in: [tmdbId, Number(tmdbId)] }, media_type } },
    },
    { projection: { profileId: 1, userId: 1 } },
  ).toArray()
  if (savers.length === 0) return
  const media = await resolveShareMedia(media_type, tmdbId)
  if (!media) return
  const byProfile = new Map(friends.map((friend) => [friend.profileId, friend]))
  for (const saver of savers) {
    const friend = byProfile.get(String(saver.profileId))
    if (!friend || friend.userId !== saver.userId) continue
    await notify({
      to: friend,
      kind: 'friend_rated',
      key: `${ref.profileId}:${media_type}:${tmdbId}`,
      href: mediaHref(media_type, media.id),
      text: { key: 'social.inbox.friendRated', vars: { name: page.name, title: media.title, stars } },
      actor: ref,
      media,
      merge: true,
      push: false,
    }).catch((error) => console.error('friend_rated notify failed', error))
  }
}

export async function PUT(request: Request) {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner.error
  const ref: ProfileRef = { userId: owner.userId, profileId: owner.profile.id }
  const limited = await socialRateLimit([[`ratings:${owner.userId}`, 120, 60 * 60]])
  if (limited) return limited
  const body = await readJson(request)
  const title = parseTitle(body?.type, body?.id)
  const stars = body?.rating
  if (!title || typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) return socialError(400, 'invalid')

  let first: boolean
  try {
    first = (await setRating(ref, { ...title, stars: stars as 1 | 2 | 3 | 4 | 5 })).first
  } catch (error) {
    if (error instanceof UnknownTitleError) return socialError(404, 'unknown_title')
    throw error
  }

  let hint: 'private' | 'shared' | null = null
  if (first && !owner.profile.kids) {
    const page = await loadSocialProfile(ref.profileId)
    const privacy = normalizePrivacy(page?.privacy)
    hint = !page || privacy.ratings === 'private' || privacy.paused ? 'private' : 'shared'
  }
  if (stars >= 4 && !owner.profile.kids) {
    await tellFriends(ref, title.media_type, title.tmdbId, stars).catch((error) => console.error('friend_rated failed', error))
  }
  return socialJson({ mine: stars, first, hint })
}

export async function DELETE(request: Request) {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner.error
  const limited = await socialRateLimit([[`ratings:${owner.userId}`, 120, 60 * 60]])
  if (limited) return limited
  const params = new URL(request.url).searchParams
  const title = parseTitle(params.get('type'), params.get('id'))
  if (!title) return socialError(400, 'invalid')
  await clearRating({ userId: owner.userId, profileId: owner.profile.id }, title.media_type, title.tmdbId)
  return socialJson({ mine: null })
}
