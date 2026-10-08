// Who sees what of your page. Opening something up never reveals the past: activity shows from the
// moment it leaves 'Only me' (or sharing resumes), ratings from the moment they leave it, unless
// you explicitly share your past ratings too.
import { revalidateTag } from 'next/cache'
import { socialDb, type SocialProfileDoc } from '@/src/lib/social/db'
import { getFriends } from '@/src/lib/social/friends'
import { newShareKey, normalizePrivacy } from '@/src/lib/social/privacy'
import { readJson, requireSocial, socialError, socialJson } from '@/src/lib/social/session'
import type { PrivacySettings } from '@/src/lib/social/types'

export const dynamic = 'force-dynamic'

const shareUrl = (doc: Pick<SocialProfileDoc, 'handle' | 'shareKey'>) => `/u/${doc.handle}?k=${doc.shareKey}`

export async function GET() {
  const gate = await requireSocial()
  if ('error' in gate) return gate.error
  const { social } = gate
  return socialJson({
    privacy: normalizePrivacy(social?.privacy),
    handle: social?.handle ?? null,
    shareUrl: social ? shareUrl(social) : null,
  })
}

const isVisibility = (value: unknown): value is PrivacySettings['ratings'] => value === 'private' || value === 'friends' || value === 'link'

export async function PATCH(request: Request) {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  const { ref } = gate
  const social = gate.social!
  const body = await readJson(request)
  if (!body) return socialError(400, 'invalid')

  const before = normalizePrivacy(social.privacy)
  const next: PrivacySettings = { ...before }
  if (body.activity !== undefined) {
    if (body.activity !== 'private' && body.activity !== 'friends') return socialError(400, 'invalid')
    next.activity = body.activity
  }
  for (const key of ['ratings', 'badges'] as const) {
    if (body[key] === undefined) continue
    if (!isVisibility(body[key])) return socialError(400, 'invalid')
    next[key] = body[key] as PrivacySettings['ratings']
  }
  if (body.requests !== undefined) {
    if (body.requests !== 'anyone' && body.requests !== 'nobody') return socialError(400, 'invalid')
    next.requests = body.requests
  }
  if (body.paused !== undefined) {
    if (typeof body.paused !== 'boolean') return socialError(400, 'invalid')
    next.paused = body.paused
  }

  const now = new Date()
  const set: Partial<SocialProfileDoc> = { privacy: next, updatedAt: now }
  if ((before.activity === 'private' && next.activity !== 'private') || (before.paused && !next.paused)) set.activitySince = now
  if (before.ratings === 'private' && next.ratings !== 'private') set.ratingsVisibleSince = now
  if (body.sharePastRatings === true) set.ratingsVisibleSince = new Date(0)
  if (body.resetShareKey === true) set.shareKey = newShareKey()

  const { profiles } = await socialDb()
  const updated = await profiles.findOneAndUpdate({ _id: ref.profileId, userId: ref.userId }, { $set: set }, { returnDocument: 'after' })
  if (!updated.value) return socialError(404, 'not_found')

  // Friends' feeds are cached for 5 minutes: what they may see just changed.
  if (JSON.stringify(before) !== JSON.stringify(next) || set.ratingsVisibleSince) {
    const friends = await getFriends(ref.profileId).catch(() => [])
    for (const friend of friends.slice(0, 200)) revalidateTag(`friends:${friend.profileId}`)
  }
  return socialJson({ privacy: normalizePrivacy(updated.value.privacy), shareUrl: shareUrl(updated.value) })
}
