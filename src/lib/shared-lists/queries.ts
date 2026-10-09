// Reading lists for one person: their own and the ones they help build (/lists, "Add to a list"),
// the ones a page shows (/me, /u/[handle]), and what changed in them this week (the digest).
import 'server-only'
import type { Filter } from 'mongodb'
import { listsCollection, type ListDoc } from '@/src/lib/lists-db'
import { loadProfiles } from '@/src/lib/profiles'
import { areFriends, blockedAccounts, isBlockedEitherWay } from '@/src/lib/social/friends'
import type { AvatarPerson, ProfileRef } from '@/src/lib/social/types'
import type { DigestContext, DigestProvider, DigestSection } from '@/src/lib/digest/providers'
import { MAX_JOINED, MAX_OWNED, itemKey, livePending, unreadCount, visibilityOf, type ListVisibility } from './rules'
import { membersOf, ownerProfileOf, peopleFor, UNKNOWN_PERSON, type ListViewer } from './server'
import type { ListInvitation, MyListSummary, MyListsResponse } from './types'

const postersOf = (list: ListDoc) => list.items.slice(0, 3).map((item) => item.poster_path)

/** Lists an account owns that a given profile counts as the owner of (older lists belong to the first profile). */
async function ownedByProfile(owner: ProfileRef): Promise<Filter<ListDoc>> {
  const first = (await loadProfiles(owner.userId))[0]?.id
  return {
    userId: owner.userId,
    $or: [{ ownerProfileId: owner.profileId }, ...(first === owner.profileId ? [{ ownerProfileId: { $exists: false } }] : [])],
  } as Filter<ListDoc>
}

/**
 * Everything on /lists for the viewer: the account's lists and the ones they were let into, with
 * up to four faces each and what's new since they last looked, plus invitations by name.
 * Kids only get the lists their own profile made.
 */
export async function myLists(viewer: ListViewer, opts: { contains?: string | null } = {}): Promise<MyListsResponse> {
  const collection = await listsCollection()
  let filter: Filter<ListDoc>
  if (viewer.kids) {
    if (!viewer.profileId) return { lists: [], invitations: [], kids: true }
    filter = await ownedByProfile({ userId: viewer.userId, profileId: viewer.profileId })
  } else {
    filter = { $or: [{ userId: viewer.userId }, ...(viewer.profileId ? [{ 'members.profileId': viewer.profileId }] : [])] } as Filter<ListDoc>
  }
  const [docs, blocked] = await Promise.all([
    collection.find(filter, { projection: { pending: 0 } }).sort({ updatedAt: -1 }).limit(MAX_OWNED + MAX_JOINED).toArray(),
    viewer.kids ? Promise.resolve(new Set<string>()) : blockedAccounts(viewer.userId),
  ])
  // A block with a list's owner hides that list (they may still be in it).
  const visible = docs.filter((doc) => doc.userId === viewer.userId || !blocked.has(doc.userId))

  const owners = await Promise.all(visible.map((doc) => ownerProfileOf(doc)))
  const memberLists = visible.map((doc, index) => membersOf(doc, owners[index]))
  const faces = await peopleFor(memberLists.flatMap((members) => members.slice(0, 4).map((entry) => ({ userId: entry.userId, profileId: entry.profileId }))))

  const lists: MyListSummary[] = visible.map((doc, index) => {
    const members = memberLists[index]
    const me = viewer.profileId ? members.find((entry) => entry.profileId === viewer.profileId) : undefined
    return {
      slug: doc.slug,
      title: doc.title,
      posters: postersOf(doc),
      count: doc.items.length,
      updatedAt: new Date(doc.updatedAt).toISOString(),
      role: doc.userId === viewer.userId ? 'owner' : 'editor',
      visibility: visibilityOf(doc),
      members: members.length > 1 ? members.slice(0, 4).map((entry) => faces.get(entry.profileId) ?? UNKNOWN_PERSON) : [],
      memberCount: members.length,
      unread: me && members.length > 1 ? unreadCount(doc.activity, doc.items, viewer.profileId, me.lastSeenAt) : 0,
      ...(opts.contains ? { contains: doc.items.some((item) => itemKey(item) === opts.contains) } : {}),
    }
  })

  let invitations: ListInvitation[] = []
  if (!viewer.kids && viewer.profileId) {
    const now = Date.now()
    const waiting = await collection.find({ 'pending.profileId': viewer.profileId }, { projection: { activity: 0 } }).sort({ updatedAt: -1 }).limit(20).toArray()
    const open: { doc: ListDoc; invite: NonNullable<ListDoc['pending']>[number] }[] = []
    for (const doc of waiting) {
      if (blocked.has(doc.userId)) continue
      const invite = livePending(doc.pending, now).find((entry) => entry.profileId === viewer.profileId)
      if (invite) open.push({ doc, invite })
    }
    const inviters = await peopleFor(open.map(({ doc, invite }) => ({ userId: doc.userId, profileId: invite.invitedBy })))
    invitations = open.map(({ doc, invite }) => ({
      slug: doc.slug,
      title: doc.title,
      posters: postersOf(doc),
      count: doc.items.length,
      inviter: inviters.get(invite.invitedBy) ?? null,
      at: new Date(invite.at).toISOString(),
    }))
  }
  return { lists, invitations, kids: viewer.kids }
}

/** The lists `ref` helps build (not their own account's). */
export async function getMemberLists(ref: ProfileRef): Promise<ListDoc[]> {
  const collection = await listsCollection()
  return collection.find({ 'members.profileId': ref.profileId, userId: { $ne: ref.userId } }).sort({ updatedAt: -1 }).limit(MAX_JOINED).toArray()
}

export type ProfileListTile = {
  slug: string
  title: string
  posters: (string | null)[]
  count: number
  visibility: ListVisibility
  members: AvatarPerson[]
  memberCount: number
}

const toTile = (doc: ListDoc, members: AvatarPerson[], memberCount: number): ProfileListTile => ({
  slug: doc.slug,
  title: doc.title,
  posters: postersOf(doc),
  count: doc.items.length,
  visibility: visibilityOf(doc),
  members,
  memberCount,
})

async function tilesWithFaces(docs: ListDoc[]): Promise<ProfileListTile[]> {
  const owners = await Promise.all(docs.map((doc) => ownerProfileOf(doc)))
  const memberLists = docs.map((doc, index) => membersOf(doc, owners[index]))
  const faces = await peopleFor(memberLists.flatMap((members) => members.slice(0, 4).map((entry) => ({ userId: entry.userId, profileId: entry.profileId }))))
  return docs.map((doc, index) => {
    const members = memberLists[index]
    return toTile(doc, members.length > 1 ? members.slice(0, 4).map((entry) => faces.get(entry.profileId) ?? UNKNOWN_PERSON) : [], members.length)
  })
}

/** A profile's own lists, every visibility (their own page, /me). */
export async function getOwnListsOf(owner: ProfileRef, limit = 24): Promise<ProfileListTile[]> {
  const collection = await listsCollection()
  const docs = await collection.find(await ownedByProfile(owner), { projection: { activity: 0, pending: 0 } }).sort({ updatedAt: -1 }).limit(limit).toArray()
  return tilesWithFaces(docs)
}

/**
 * The lists someone else's page shows: the ones its owner chose to open up, never a private one,
 * and never one whose visibility was never chosen (older lists keep to their link). 'friends' lists
 * for their friends; 'link' lists for friends and whoever holds the page's share link.
 */
export async function getPublicListsOf(owner: ProfileRef, viewer: ProfileRef | null, linkAccess: boolean, limit = 24): Promise<ProfileListTile[]> {
  if (viewer && viewer.profileId !== owner.profileId && (await isBlockedEitherWay(viewer, owner))) return []
  const friends = !!viewer && viewer.profileId !== owner.profileId && (await areFriends(owner.profileId, viewer.profileId))
  const allowed: ListVisibility[] = friends ? ['friends', 'link'] : linkAccess ? ['link'] : []
  if (allowed.length === 0) return []
  const collection = await listsCollection()
  const docs = await collection.find(
    { userId: owner.userId, ownerProfileId: owner.profileId, visibility: { $in: allowed } },
    { projection: { activity: 0, pending: 0 } },
  ).sort({ updatedAt: -1 }).limit(limit).toArray()
  // Never the editors' faces on someone else's page: only the owner's name, as on the list itself.
  return docs.map((doc) => toTile(doc, [], 0))
}

/**
 * This week in the profile's shared lists: titles other people added (at most 8, newest first),
 * as poster tiles. Null when nothing happened.
 */
export async function getSharedListDigest(ctx: DigestContext): Promise<DigestSection | null> {
  const collection = await listsCollection()
  const docs = await collection.find(
    { 'members.profileId': ctx.profileId, 'members.1': { $exists: true }, updatedAt: { $gte: ctx.since } },
    { projection: { slug: 1, title: 1, items: 1, activity: 1, members: 1 } },
  ).limit(30).toArray()
  const since = ctx.since.getTime()
  const until = ctx.until.getTime()
  const tiles: { at: number; tile: { title: string; href: string; poster: string | null; line: string } }[] = []
  for (const doc of docs) {
    const present = new Set(doc.items.map(itemKey))
    const seen = new Set<string>()
    for (const entry of doc.activity ?? []) {
      const at = new Date(entry.at).getTime()
      if (entry.kind !== 'add' || !entry.item || entry.by === ctx.profileId || at < since || at >= until) continue
      const key = itemKey(entry.item)
      if (!present.has(key) || seen.has(key)) continue
      seen.add(key)
      tiles.push({ at, tile: { title: entry.item.title, href: `/lists/${doc.slug}`, poster: entry.item.poster_path, line: ctx.t('sharedLists.digest.inList', { list: doc.title }) } })
    }
  }
  if (tiles.length === 0) return null
  tiles.sort((a, b) => b.at - a.at)
  return { type: 'posters', id: 'shared-lists', title: ctx.t('sharedLists.digest.title'), tiles: tiles.slice(0, 8).map((entry) => entry.tile) }
}

/** The weekly digest's "New in your shared lists" section (registered by integration). */
export const sharedListsDigestProvider: DigestProvider = { id: 'shared-lists', build: getSharedListDigest }
