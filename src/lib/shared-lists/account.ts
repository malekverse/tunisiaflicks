// Shared lists when people leave: an account deleted, a profile removed, and what a data export
// says about lists (only your own part of them; nobody else's ids).
import 'server-only'
import { listsCollection, type ListDoc, type ListMemberDoc } from '@/src/lib/lists-db'
import { revokeInvites } from '@/src/lib/invites'
import { loadProfiles } from '@/src/lib/profiles'
import { nameOf } from './server'
import { visibilityOf } from './rules'

/** The editor who has been in the list the longest, from another account. */
const heirOf = (list: ListDoc, leavingUserId: string): ListMemberDoc | null =>
  (list.members ?? [])
    .filter((entry) => entry.role === 'editor' && entry.userId !== leavingUserId)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0] ?? null

/** Gives `list` to `heir`: they become its owner, and everyone from `leavingUserId` leaves it. */
async function handOver(list: ListDoc, heir: ListMemberDoc, leavingUserId: string, leavingProfiles: string[]) {
  const collection = await listsCollection()
  const ownerName = (await nameOf({ userId: heir.userId, profileId: heir.profileId })) || list.ownerName
  await collection.updateOne(
    { slug: list.slug, userId: list.userId },
    {
      $set: {
        userId: heir.userId,
        ownerProfileId: heir.profileId,
        ownerName,
        'members.$[heir].role': 'owner',
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    { arrayFilters: [{ 'heir.id': heir.id }] },
  )
  await collection.updateOne(
    { slug: list.slug },
    {
      $pull: {
        members: { userId: leavingUserId },
        pending: { invitedBy: { $in: leavingProfiles } },
        activity: { by: { $in: leavingProfiles } },
      },
    } as never,
  )
  await revokeInvites('list', list.slug)
}

/**
 * Before an account is deleted (runs BEFORE the generic deleteMany on `lists`): each list it owns
 * that others help build goes to the longest-standing editor; the others are deleted; its
 * profiles leave every list they were in, and their traces (who added what, recent changes) go.
 */
export async function onAccountDeleted(userId: string): Promise<void> {
  const collection = await listsCollection()
  const profiles = (await loadProfiles(userId)).map((profile) => profile.id)
  const owned = await collection.find({ userId }).toArray()
  for (const list of owned) {
    const heir = heirOf(list, userId)
    if (heir) await handOver(list, heir, userId, profiles)
    else {
      await collection.deleteOne({ slug: list.slug, userId })
      await revokeInvites('list', list.slug)
    }
  }
  await scrubProfiles(userId, profiles)
}

/** Takes profiles out of other people's lists: membership, invitations, authorship, recent changes. */
async function scrubProfiles(userId: string, profileIds: string[]) {
  if (profileIds.length === 0) return
  const collection = await listsCollection()
  const touched = { $or: [{ 'members.profileId': { $in: profileIds } }, { 'pending.profileId': { $in: profileIds } }, { 'items.by': { $in: profileIds } }, { 'activity.by': { $in: profileIds } }] }
  await collection.updateMany(
    { ...touched, userId: { $ne: userId } },
    {
      $pull: {
        members: { profileId: { $in: profileIds } },
        pending: { profileId: { $in: profileIds } },
        activity: { by: { $in: profileIds } },
      },
      $inc: { version: 1 },
    } as never,
  )
  await collection.updateMany(
    { 'items.by': { $in: profileIds }, userId: { $ne: userId } },
    { $unset: { 'items.$[gone].by': '' } },
    { arrayFilters: [{ 'gone.by': { $in: profileIds } }] },
  )
}

/**
 * A profile is removed from its account. Lists it owned that others help build go to the
 * longest-standing editor; the ones only it used stay with the account (its first profile adopts
 * them again). It leaves every list it was in.
 */
export async function onProfileRemovedFromLists(userId: string, profileId: string): Promise<void> {
  const collection = await listsCollection()
  const owned = await collection.find({ userId, ownerProfileId: profileId }).toArray()
  for (const list of owned) {
    const heir = heirOf(list, userId)
    if (heir) await handOver(list, heir, userId, [profileId])
    else {
      await collection.updateOne(
        { slug: list.slug, userId, ownerProfileId: profileId },
        { $unset: { ownerProfileId: '', members: '', pending: '', 'items.$[].by': '' }, $set: { activity: [] }, $inc: { version: 1 } },
      )
      await revokeInvites('list', list.slug)
    }
  }
  await scrubProfiles(userId, [profileId])
  // The account's own shared lists the profile helped with (as another of its profiles).
  await collection.updateMany(
    { userId, 'members.profileId': profileId },
    { $pull: { members: { profileId, role: 'editor' } } as never, $inc: { version: 1 } },
  )
}

const ownItems = (list: ListDoc, profiles: Set<string>) =>
  list.items
    .filter((item) => item.by && profiles.has(item.by))
    .map(({ id, media_type, title, added_at }) => ({ id, media_type, title, added_at }))

/**
 * For "Download my data": the account's own lists (titles, visibility, every item, how many people
 * are in each) and the lists it helps build elsewhere (only its role and the titles it added).
 * No other person's ids, names or items.
 */
export async function exportMemberships(userId: string): Promise<{ owned: unknown[]; joined: unknown[] }> {
  const collection = await listsCollection()
  const profiles = new Set((await loadProfiles(userId)).map((profile) => profile.id))
  const [owned, joined] = await Promise.all([
    collection.find({ userId }).toArray(),
    collection.find({ 'members.profileId': { $in: Array.from(profiles) }, userId: { $ne: userId } }).toArray(),
  ])
  return {
    owned: owned.map((list) => ({
      slug: list.slug,
      title: list.title,
      description: list.description,
      visibility: visibilityOf(list),
      people: Math.max(1, list.members?.length ?? 1),
      items: list.items.map(({ id, media_type, title, added_at, by }) => ({ id, media_type, title, added_at, addedByYou: !by || profiles.has(by) })),
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    })),
    joined: joined.map((list) => {
      const me = (list.members ?? []).find((entry) => profiles.has(entry.profileId))
      return {
        title: list.title,
        role: me?.role ?? 'editor',
        joinedAt: me?.joinedAt ?? null,
        yourItems: ownItems(list, profiles),
      }
    }),
  }
}
