// Friend requests. POST {handle} asks; POST {token} accepts a friend invite link (instant
// friends); PATCH {id, accept} answers; DELETE ?id= cancels your own. A declined request is
// never announced: asking again (from any profile of that account) is silently swallowed.
import { revalidateTag } from 'next/cache'
import { ObjectId } from 'mongodb'
import { consumeInvite, isInviteToken, readInvite } from '@/src/lib/invites'
import { notify, retractNotification, settleNotificationAction } from '@/src/lib/notify'
import { socialDb, DAYS, type FriendshipDoc, type SocialProfileDoc } from '@/src/lib/social/db'
import { MAX_FRIENDS, MAX_PENDING_OUTGOING, graphCounts, isBlockedEitherWay, otherSide } from '@/src/lib/social/friends'
import { getIdentity, resolveHandle } from '@/src/lib/social/identity'
import { normalizePrivacy } from '@/src/lib/social/privacy'
import { pairKey } from '@/src/lib/social/rules'
import { readJson, requireSocial, socialError, socialJson, socialRateLimit } from '@/src/lib/social/session'
import type { ProfileRef } from '@/src/lib/social/types'

export const dynamic = 'force-dynamic'

const PENDING_DAYS = 90

/** Tells the other person they have a new friend (and refreshes both feeds). */
async function announceFriends(me: ProfileRef, mine: SocialProfileDoc, them: ProfileRef, key: string) {
  revalidateTag(`friends:${me.profileId}`)
  revalidateTag(`friends:${them.profileId}`)
  await notify({
    to: them,
    kind: 'friend_accepted',
    key,
    href: `/u/${mine.handle}`,
    text: { key: 'social.inbox.friendAccepted', vars: { name: mine.name } },
    actor: me,
    push: { topic: 'friends', title: { key: 'social.push.friendAcceptedTitle' }, body: { key: 'social.inbox.friendAccepted', vars: { name: mine.name } } },
  }).catch((error) => console.error('friend_accepted notify failed', error))
}

async function acceptRow(row: FriendshipDoc, me: ProfileRef, mine: SocialProfileDoc, via?: 'invite') {
  const { friendships } = await socialDb()
  await friendships.updateOne(
    { _id: row._id },
    { $set: { status: 'accepted', acceptedAt: new Date(), ...(via ? { via } : {}) }, $unset: { expiresAt: '', requesterCancelled: '' } },
  )
  const them = otherSide(row, me.profileId)
  await settleNotificationAction(me, { type: 'friend_request', id: String(row._id) }, 'accepted')
  await announceFriends(me, mine, them, String(row._id))
}

async function friendsCapReached(a: string, b: string) {
  const [mine, theirs] = await Promise.all([graphCounts(a), graphCounts(b)])
  return mine.friends >= MAX_FRIENDS || theirs.friends >= MAX_FRIENDS
}

export async function POST(request: Request) {
  const gate = await requireSocial({ needsHandle: true, write: true })
  if ('error' in gate) return gate.error
  const me = gate.ref
  const mine = gate.social!
  const body = await readJson(request)
  const { friendships } = await socialDb()

  // ---- An invite link: friends at once --------------------------------------------------------
  if (body?.token !== undefined) {
    if (!isInviteToken(body.token)) return socialError(404, 'invalid')
    const invite = await readInvite('friend', body.token)
    if (!invite) return socialError(410, 'invalid')
    const owner = invite.owner
    if (owner.userId === me.userId) return socialError(400, 'self')
    if (await isBlockedEitherWay(me, owner)) return socialError(404, 'not_found')
    const person = await getIdentity(owner.profileId)
    if (!person) return socialError(404, 'not_found')
    const existing = await friendships.findOne({ pair: pairKey(me.profileId, owner.profileId) })
    if (existing?.status === 'accepted') return socialJson({ status: 'friends', person })
    if (await friendsCapReached(me.profileId, owner.profileId)) return socialError(409, 'friends_cap')
    const used = await consumeInvite('friend', body.token)
    if ('reason' in used) return socialError(410, used.reason)
    if (existing) {
      await acceptRow(existing, me, mine, 'invite')
    } else {
      const row: Omit<FriendshipDoc, '_id'> = {
        pair: pairKey(me.profileId, owner.profileId),
        profiles: [owner.profileId, me.profileId],
        users: [owner.userId, me.userId],
        status: 'accepted',
        requestedBy: me.profileId,
        requestedByUser: me.userId,
        via: 'invite',
        createdAt: new Date(),
        acceptedAt: new Date(),
      }
      const inserted = await friendships.insertOne(row as FriendshipDoc).catch(() => null)
      if (!inserted) return socialJson({ status: 'friends', person })
      await announceFriends(me, mine, owner, String(inserted.insertedId))
    }
    return socialJson({ status: 'friends', person }, 201)
  }

  // ---- A request by handle ----------------------------------------------------------------------
  const limited = await socialRateLimit([[`social:requests:${me.userId}`, 20, 24 * 60 * 60]])
  if (limited) return limited
  const target = typeof body?.handle === 'string' ? await resolveHandle(body.handle) : null
  if (!target) return socialError(404, 'not_found')
  if (target.userId === me.userId) return socialError(400, 'self')
  if (await isBlockedEitherWay(me, target)) return socialError(404, 'not_found')

  const pair = pairKey(me.profileId, target.profileId)
  const existing = await friendships.findOne({ pair })
  if (existing?.status === 'accepted') return socialJson({ status: 'friends' })
  if (existing?.status === 'pending') {
    if (existing.requestedBy === me.profileId) return socialJson({ status: 'outgoing' })
    // They asked first: asking back says yes.
    await acceptRow(existing, me, mine)
    return socialJson({ status: 'friends' })
  }
  if (existing?.status === 'declined' && existing.requestedBy === me.profileId) {
    await friendships.updateOne({ _id: existing._id }, { $unset: { requesterCancelled: '' } })
    return socialJson({ status: 'outgoing' }, 201)
  }
  const tombstone = await friendships.findOne({ status: 'declined', profiles: target.profileId, requestedByUser: me.userId })
  if (tombstone) return socialJson({ status: 'outgoing' }, 201)

  const page = await socialDb().then(({ profiles }) => profiles.findOne({ _id: target.profileId }, { projection: { privacy: 1 } }))
  if (normalizePrivacy(page?.privacy).requests === 'nobody') return socialError(403, 'requests_off')
  const counts = await graphCounts(me.profileId)
  if (counts.outgoing >= MAX_PENDING_OUTGOING) return socialError(429, 'too_many_pending')
  if (await friendsCapReached(me.profileId, target.profileId)) return socialError(409, 'friends_cap')

  const now = new Date()
  let id: string
  if (existing) {
    // A request they once sent and I declined: now I'm the one asking.
    await friendships.updateOne(
      { _id: existing._id },
      { $set: { status: 'pending', requestedBy: me.profileId, requestedByUser: me.userId, via: 'handle', createdAt: now, expiresAt: new Date(now.getTime() + DAYS(PENDING_DAYS)) }, $unset: { requesterCancelled: '' } },
    )
    id = String(existing._id)
  } else {
    const row: Omit<FriendshipDoc, '_id'> = {
      pair,
      profiles: [me.profileId, target.profileId],
      users: [me.userId, target.userId],
      status: 'pending',
      requestedBy: me.profileId,
      requestedByUser: me.userId,
      via: 'handle',
      createdAt: now,
      expiresAt: new Date(now.getTime() + DAYS(PENDING_DAYS)),
    }
    try {
      id = String((await friendships.insertOne(row as FriendshipDoc)).insertedId)
    } catch {
      return socialJson({ status: 'outgoing' })
    }
  }
  await notify({
    to: { userId: target.userId, profileId: target.profileId },
    kind: 'friend_request',
    key: id,
    href: `/u/${mine.handle}`,
    text: { key: 'social.inbox.friendRequest', vars: { name: mine.name } },
    actor: me,
    action: { type: 'friend_request', id },
    push: { topic: 'friends', title: { key: 'social.push.friendRequestTitle' }, body: { key: 'social.inbox.friendRequest', vars: { name: mine.name } } },
  }).catch((error) => console.error('friend_request notify failed', error))
  return socialJson({ status: 'outgoing' }, 201)
}

export async function PATCH(request: Request) {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  const me = gate.ref
  const body = await readJson(request)
  const id = typeof body?.id === 'string' && ObjectId.isValid(body.id) ? new ObjectId(body.id) : null
  if (!id || typeof body?.accept !== 'boolean') return socialError(400, 'invalid')
  const { friendships } = await socialDb()
  const row = await friendships.findOne({ _id: id, profiles: me.profileId, status: 'pending', requestedBy: { $ne: me.profileId } })
  if (!row) {
    // Already answered (from another device, or the request was cancelled): settle the row anyway.
    await settleNotificationAction(me, { type: 'friend_request', id: String(id) }, body.accept ? 'accepted' : 'declined')
    return socialError(404, 'not_found')
  }
  if (body.accept) {
    if (await friendsCapReached(me.profileId, otherSide(row, me.profileId).profileId)) return socialError(409, 'friends_cap')
    await acceptRow(row, me, gate.social!)
    return socialJson({ status: 'friends' })
  }
  const now = new Date()
  await friendships.updateOne({ _id: id }, { $set: { status: 'declined', expiresAt: new Date(now.getTime() + DAYS(PENDING_DAYS)) } })
  await settleNotificationAction(me, { type: 'friend_request', id: String(id) }, 'declined')
  return socialJson({ status: 'none' })
}

export async function DELETE(request: Request) {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  const me = gate.ref
  const raw = new URL(request.url).searchParams.get('id')
  if (!raw || !ObjectId.isValid(raw)) return socialError(400, 'invalid')
  const { friendships } = await socialDb()
  const row = await friendships.findOne({ _id: new ObjectId(raw), requestedBy: me.profileId, status: { $in: ['pending', 'declined'] } })
  if (!row) return socialError(404, 'not_found')
  if (row.status === 'declined') {
    // Keep the tombstone; just stop showing it as sent.
    await friendships.updateOne({ _id: row._id }, { $set: { requesterCancelled: true } })
  } else {
    await friendships.deleteOne({ _id: row._id })
    await retractNotification(otherSide(row, me.profileId), 'friend_request', String(row._id))
  }
  return socialJson({ ok: true })
}
