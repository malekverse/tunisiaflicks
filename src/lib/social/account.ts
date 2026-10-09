// The social layer's part of the account pipeline: export, deletion (whole account or one profile),
// and the reset that follows a profile becoming (or stopping being) a Kids profile.
import 'server-only'
import { socialDb, DAYS } from './db'
import { getIdentities } from './identity'
import { HANDLE_HOLD_DAYS } from './identity'
import type { ProfileRef } from './types'

/** Other people appear in an export by name and handle only (never their ids). */
const person = (identities: Map<string, { handle: string; name: string }>, profileId: string) => {
  const identity = identities.get(profileId)
  return identity ? { handle: identity.handle, name: identity.name } : { handle: null, name: null }
}

export async function exportSocialData(userId: string): Promise<unknown> {
  const { profiles, handles, friendships, blocks, invites, ratings } = await socialDb()
  const [pages, handleRows, friendRows, blockRows, inviteRows, ratingRows] = await Promise.all([
    profiles.find({ userId }).toArray(),
    handles.find({ userId }).toArray(),
    friendships.find({ users: userId }).toArray(),
    blocks.find({ blockerUserId: userId }).toArray(),
    invites.find({ 'owner.userId': userId }).toArray(),
    ratings.find({ userId }).toArray(),
  ])
  const mine = new Set(pages.map((page) => page._id))
  const others = [
    ...friendRows.flatMap((row) => row.profiles.filter((id) => !mine.has(id))),
    ...blockRows.map((row) => row.blockedProfileId),
  ]
  const identities = await getIdentities(others)
  return {
    pages: pages.map((page) => ({
      profileId: page._id,
      handle: page.handle,
      name: page.name,
      bio: page.bio,
      usePhoto: page.usePhoto,
      privacy: page.privacy,
      activitySince: page.activitySince,
      ratingsVisibleSince: page.ratingsVisibleSince,
      createdAt: page.createdAt,
    })),
    handles: handleRows.map((row) => ({ handle: row._id, profileId: row.profileId, current: row.current, changedAt: row.changedAt ?? null })),
    friendships: friendRows.map((row) => {
      const minePosition = mine.has(row.profiles[0]) ? 0 : 1
      return {
        profileId: row.profiles[minePosition],
        with: person(identities, row.profiles[1 - minePosition]),
        status: row.status,
        requestedByYou: row.requestedBy === row.profiles[minePosition],
        createdAt: row.createdAt,
        acceptedAt: row.acceptedAt ?? null,
      }
    }),
    blocks: blockRows.map((row) => ({ profileId: row.blockerProfileId, blocked: person(identities, row.blockedProfileId), createdAt: row.createdAt })),
    invites: inviteRows.map((row) => ({ kind: row.kind, createdAt: row.createdAt, expiresAt: row.expiresAt, uses: row.uses, maxUses: row.maxUses, revoked: !!row.revokedAt })),
    ratings: ratingRows.map((row) => ({ profileId: row.profileId, media_type: row.media_type, tmdbId: row.tmdbId, title: row.title, stars: row.stars, ratedAt: row.ratedAt, updatedAt: row.updatedAt })),
  }
}

/** Notifications other people got from `match` (a user or a profile as actor): removed, or the actor taken out of a merged one. */
async function forgetActor(match: { userId: string } | { profileId: string }) {
  const { notifications } = await socialDb()
  const single = 'userId' in match ? { 'actor.userId': match.userId } : { 'actor.profileId': match.profileId }
  const merged = 'userId' in match ? { 'actors.userId': match.userId } : { 'actors.profileId': match.profileId }
  const pull = 'userId' in match ? { actors: { userId: match.userId } } : { actors: { profileId: match.profileId } }
  // A merged notification whose first actor leaves keeps the others (and loses any note).
  await notifications.updateMany(merged as never, { $pull: pull as never, $inc: { actorCount: -1 }, $unset: { note: '' } })
  await notifications.updateMany({ ...single, 'actors.0': { $exists: true } } as never, [{ $set: { actor: { $arrayElemAt: ['$actors', 0] } } }] as never)
  await notifications.deleteMany({ ...single, $or: [{ actors: { $exists: false } }, { actors: { $size: 0 } }] } as never)
}

export async function deleteSocialData(userId: string): Promise<void> {
  const { profiles, handles, friendships, blocks, invites, ratings } = await socialDb()
  await Promise.all([
    profiles.deleteMany({ userId }),
    handles.deleteMany({ userId }),
    friendships.deleteMany({ users: userId }),
    blocks.deleteMany({ $or: [{ blockerUserId: userId }, { blockedUserId: userId }] }),
    invites.deleteMany({ 'owner.userId': userId }),
    ratings.deleteMany({ userId }),
  ])
  await forgetActor({ userId })
}

export async function deleteSocialProfile(ref: ProfileRef): Promise<void> {
  const { profiles, handles, friendships, blocks, invites, ratings, notifications, push } = await socialDb()
  await Promise.all([
    profiles.deleteOne({ _id: ref.profileId, userId: ref.userId }),
    handles.deleteMany({ profileId: ref.profileId, userId: ref.userId }),
    friendships.deleteMany({ profiles: ref.profileId }),
    blocks.deleteMany({ $or: [{ blockerProfileId: ref.profileId }, { blockedProfileId: ref.profileId }] }),
    invites.deleteMany({ 'owner.profileId': ref.profileId, 'owner.userId': ref.userId }),
    ratings.deleteMany({ profileId: ref.profileId, userId: ref.userId }),
    notifications.deleteMany({ userId: ref.userId, profileId: ref.profileId }),
    push.updateMany({ userId: ref.userId, profileId: ref.profileId }, { $set: { profileId: null, profileKids: false }, $pull: { topics: { $in: ['friends', 'nights'] } } as never }),
  ])
  await forgetActor({ profileId: ref.profileId })
}

/**
 * 'Delete my page' (Settings > Friends and privacy): the page, its friends, requests and invites
 * go; the handle is held (not released) for 90 days so nobody can pose as them; blocks stay;
 * ratings stay, private (a new page starts sharing from its own creation).
 */
export async function deleteSocialPage(ref: ProfileRef): Promise<void> {
  const { profiles, handles, friendships, invites, notifications } = await socialDb()
  const now = new Date()
  await Promise.all([
    profiles.deleteOne({ _id: ref.profileId, userId: ref.userId }),
    handles.updateMany(
      { profileId: ref.profileId, userId: ref.userId, current: true },
      { $set: { current: false, changedAt: new Date(0), until: new Date(now.getTime() + DAYS(HANDLE_HOLD_DAYS)) } },
    ),
    friendships.deleteMany({ profiles: ref.profileId }),
    invites.deleteMany({ 'owner.profileId': ref.profileId, 'owner.userId': ref.userId }),
    notifications.deleteMany({ userId: ref.userId, profileId: ref.profileId, kind: { $in: ['friend_request', 'friend_accepted', 'title_sent', 'friend_rated'] } }),
  ])
  await forgetActor({ profileId: ref.profileId })
}

export async function resetSocialVisibility(profileId: string): Promise<void> {
  const { profiles } = await socialDb()
  const now = new Date()
  await profiles.updateOne({ _id: profileId }, { $set: { activitySince: now, ratingsVisibleSince: now, updatedAt: now } })
}
