// Your friends, requests and blocked people. GET ?summary=1 is the menu sheet's Friends tile.
// DELETE ?handle=x removes a friend (or a request), with &block=1 also blocks them (their whole
// account); DELETE ?unblock=<id or handle> lifts a block.
import { revalidateTag } from 'next/cache'
import { ObjectId } from 'mongodb'
import { retractNotification, settleNotificationAction } from '@/src/lib/notify'
import { socialDb } from '@/src/lib/social/db'
import { friendRows, otherSide } from '@/src/lib/social/friends'
import { getIdentities, resolveHandle } from '@/src/lib/social/identity'
import { pairKey } from '@/src/lib/social/rules'
import { requireSocial, socialError, socialJson } from '@/src/lib/social/session'
import type { PublicIdentity } from '@/src/lib/social/types'

export const dynamic = 'force-dynamic'

const byName = (a: { person: PublicIdentity }, b: { person: PublicIdentity }) => a.person.name.localeCompare(b.person.name)

export async function GET(request: Request) {
  const gate = await requireSocial()
  if ('error' in gate) return gate.error
  const { ref, social } = gate
  const summary = new URL(request.url).searchParams.get('summary') === '1'
  const { friendships, blocks, notifications } = await socialDb()

  if (!social) {
    return socialJson(summary
      ? { friends: [], total: 0, pendingIncoming: 0, unreadRequests: 0 }
      : { friends: [], incoming: [], outgoing: [], blocked: [] })
  }

  if (summary) {
    const [rows, pendingIncoming, unreadRequests] = await Promise.all([
      friendRows(ref.profileId),
      friendships.countDocuments({ profiles: ref.profileId, status: 'pending', requestedBy: { $ne: ref.profileId } }),
      notifications.countDocuments({ userId: ref.userId, profileId: ref.profileId, kind: 'friend_request', read: false, 'action.state': 'pending' }),
    ])
    const identities = await getIdentities(rows.slice(0, 3).map((row) => otherSide(row, ref.profileId).profileId))
    return socialJson({
      friends: Array.from(identities.values()),
      total: rows.length,
      pendingIncoming,
      unreadRequests,
    })
  }

  const [rows, pending, blockRows] = await Promise.all([
    friendRows(ref.profileId),
    friendships.find({
      profiles: ref.profileId,
      $or: [
        { status: 'pending' },
        // A declined request still reads as sent to the person who sent it.
        { status: 'declined', requestedBy: ref.profileId, requesterCancelled: { $ne: true } },
      ],
    }).sort({ createdAt: -1 }).limit(200).toArray(),
    blocks.find({ blockerProfileId: ref.profileId }).sort({ createdAt: -1 }).toArray(),
  ])
  const identities = await getIdentities([
    ...rows.map((row) => otherSide(row, ref.profileId).profileId),
    ...pending.map((row) => otherSide(row, ref.profileId).profileId),
    ...blockRows.map((row) => row.blockedProfileId),
  ])
  const withPerson = <T,>(items: T[], profileIdOf: (item: T) => string) =>
    items.flatMap((item) => {
      const person = identities.get(profileIdOf(item))
      return person ? [{ item, person }] : []
    })

  return socialJson({
    friends: withPerson(rows, (row) => otherSide(row, ref.profileId).profileId)
      .map(({ item, person }) => ({ person, since: item.acceptedAt ?? item.createdAt }))
      .sort(byName),
    incoming: withPerson(pending.filter((row) => row.status === 'pending' && row.requestedBy !== ref.profileId), (row) => otherSide(row, ref.profileId).profileId)
      .map(({ item, person }) => ({ id: String(item._id), person, createdAt: item.createdAt })),
    outgoing: withPerson(pending.filter((row) => row.requestedBy === ref.profileId), (row) => otherSide(row, ref.profileId).profileId)
      .map(({ item, person }) => ({ id: String(item._id), person, createdAt: item.createdAt })),
    blocked: blockRows.map((row) => ({
      id: String((row as { _id?: ObjectId })._id),
      person: identities.get(row.blockedProfileId) ?? null,
      createdAt: row.createdAt,
    })),
  })
}

export async function DELETE(request: Request) {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  const { ref } = gate
  const params = new URL(request.url).searchParams
  const { friendships, blocks } = await socialDb()

  const unblock = params.get('unblock')
  if (unblock) {
    const filter = ObjectId.isValid(unblock) && unblock.length === 24
      ? { _id: new ObjectId(unblock), blockerProfileId: ref.profileId }
      : null
    if (filter) {
      await blocks.deleteOne(filter as never)
    } else {
      const target = await resolveHandle(unblock)
      if (target) await blocks.deleteOne({ blockerProfileId: ref.profileId, blockedProfileId: target.profileId })
    }
    return socialJson({ ok: true })
  }

  const handle = params.get('handle')
  const target = handle ? await resolveHandle(handle) : null
  if (!target || target.profileId === ref.profileId) return socialError(404, 'not_found')
  const row = await friendships.findOneAndDelete({ pair: pairKey(ref.profileId, target.profileId) })
  if (row.value) {
    const id = String(row.value._id)
    // Whatever request was in flight between them stops showing as pending.
    await Promise.all([
      retractNotification({ userId: target.userId, profileId: target.profileId }, 'friend_request', id),
      settleNotificationAction(ref, { type: 'friend_request', id }, 'declined'),
    ])
  }
  if (params.get('block') === '1') {
    await blocks.updateOne(
      { blockerProfileId: ref.profileId, blockedProfileId: target.profileId },
      { $setOnInsert: { blockerProfileId: ref.profileId, blockerUserId: ref.userId, blockedProfileId: target.profileId, blockedUserId: target.userId, createdAt: new Date() } },
      { upsert: true },
    )
  }
  revalidateTag(`friends:${ref.profileId}`)
  revalidateTag(`friends:${target.profileId}`)
  return socialJson({ ok: true })
}
