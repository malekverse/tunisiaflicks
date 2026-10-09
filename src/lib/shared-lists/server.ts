// Shared lists on the server: who is looking (the viewer), what they may do with a list
// (resolveAccess), the filters that carry that permission into every atomic update, the page's view
// of a list, and the notifications a change sends to the other people in it.
import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { cache } from 'react'
import { ObjectId, type Filter } from 'mongodb'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { getActiveProfile, loadProfiles } from '@/src/lib/profiles'
import { isLimitedSession } from '@/src/lib/session-scope'
import { PROFILE_COLORS } from '@/src/lib/models/Profile'
import { listsCollection, newMemberId, type ListActivityDoc, type ListDoc, type ListMemberDoc } from '@/src/lib/lists-db'
import { notify, settleNotificationAction } from '@/src/lib/notify'
import { socialDb } from '@/src/lib/social/db'
import { areFriends, isBlockedEitherWay } from '@/src/lib/social/friends'
import { getIdentities } from '@/src/lib/social/identity'
import { eventKey } from '@/src/lib/social/rules'
import type { AvatarPerson, ProfileRef } from '@/src/lib/social/types'
import {
  ACTIVITY_KEEP, MAX_JOINED, MAX_MEMBERS, accessFor, isWidening, livePending, shouldNotifyMember, updateBucket, visibilityOf,
  type ListAccess, type ListVisibility,
} from './rules'
import type { SharedListActivity, SharedListMember, SharedListView } from './types'

/** Whoever is looking: the signed-in account's active profile (null before one is picked). */
export type ListViewer = { userId: string; profileId: string | null; kids: boolean; limited: boolean }

export const loadListViewer = cache(async (): Promise<ListViewer | null> => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const active = await getActiveProfile()
  if (!active) return null
  const profile = active.profile
  return {
    userId: active.userId,
    profileId: profile?.id ?? null,
    // Until a profile is picked on this device, an account with a Kids profile counts as Kids.
    kids: profile ? profile.kids : active.profiles.some((entry) => entry.kids),
    limited: isLimitedSession(session),
  }
})

/** The viewer as a ProfileRef (null without a picked profile). */
export const viewerRef = (viewer: ListViewer | null): ProfileRef | null =>
  viewer?.profileId ? { userId: viewer.userId, profileId: viewer.profileId } : null

const firstProfileOf = cache(async (userId: string): Promise<string> => (await loadProfiles(userId))[0]?.id ?? '')

/** The list's owner profile: stored, or the owner account's first profile for older lists. */
export async function ownerProfileOf(list: Pick<ListDoc, 'ownerProfileId' | 'userId'>): Promise<string> {
  return list.ownerProfileId || firstProfileOf(list.userId)
}

export const ownerRefOf = async (list: Pick<ListDoc, 'ownerProfileId' | 'userId'>): Promise<ProfileRef> =>
  ({ userId: list.userId, profileId: await ownerProfileOf(list) })

/** The owner's member id on a list that never stored its members (stable, so keys don't change once they are). */
const ownerMemberId = (slug: string) => createHash('sha256').update(`list-owner:${slug}`).digest('base64url').slice(0, 8)

/** The people in a list, the owner first; a list nobody joined has just its owner. */
export function membersOf(list: ListDoc, ownerProfileId: string): ListMemberDoc[] {
  if (Array.isArray(list.members) && list.members.length > 0) {
    return [...list.members].sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()))
  }
  return [{ id: ownerMemberId(list.slug), userId: list.userId, profileId: ownerProfileId, role: 'owner', joinedAt: list.createdAt, lastSeenAt: list.updatedAt }]
}

/**
 * What `viewer` may do with `list`. `invited`: they hold a working invitation link to it (they may
 * look before joining). Blocks with the owner and friendship are checked only when they matter.
 */
export async function resolveAccess(list: ListDoc, viewer: ListViewer | null, opts: { invited?: boolean } = {}): Promise<{ access: ListAccess; ownerProfileId: string }> {
  const ownerProfileId = await ownerProfileOf(list)
  const base = { list, ownerProfileId, viewer, invited: opts.invited }
  if (!viewer || viewer.kids || viewer.userId === list.userId) {
    return { access: accessFor({ ...base, friends: false, blocked: false }), ownerProfileId }
  }
  const owner = { userId: list.userId, profileId: ownerProfileId }
  const blocked = await isBlockedEitherWay({ userId: viewer.userId, profileId: viewer.profileId ?? '' }, owner)
  if (blocked) return { access: 'none', ownerProfileId }
  const member = !!viewer.profileId && !!list.members?.some((entry) => entry.profileId === viewer.profileId)
  const friends = !member && visibilityOf(list) === 'friends' && !!viewer.profileId && (await areFriends(ownerProfileId, viewer.profileId))
  return { access: accessFor({ ...base, friends, blocked: false }), ownerProfileId }
}

/**
 * Gives an older list its stored members, owner profile and version (and every item its author,
 * the owner), once, before the first change that needs them. Its visibility stays unset (it reads
 * as 'link', as it always was, but was never chosen: it doesn't show on the owner's page). Returns
 * the list as stored.
 */
export async function ensureMembers(list: ListDoc): Promise<ListDoc> {
  if (Array.isArray(list.members) && list.members.length > 0 && list.ownerProfileId && typeof list.version === 'number') return list
  const ownerProfileId = await ownerProfileOf(list)
  const collection = await listsCollection()
  await collection.updateOne(
    { slug: list.slug, members: { $exists: false } },
    {
      $set: {
        ownerProfileId,
        members: membersOf({ ...list, members: undefined }, ownerProfileId),
        version: typeof list.version === 'number' ? list.version : 0,
        pending: [],
        activity: [],
        'items.$[mine].by': ownerProfileId,
      },
    },
    { arrayFilters: [{ 'mine.by': { $exists: false } }] },
  )
  return (await collection.findOne({ slug: list.slug })) ?? list
}

/** The update filter for something only the owner may do. */
export const ownerFilter = (slug: string, viewer: ListViewer): Filter<ListDoc> => ({ slug, userId: viewer.userId })

/** The update filter for a change the owner or an editor may make (the permission lives in the filter). */
export function editFilter(list: Pick<ListDoc, 'slug' | 'userId'>, viewer: ListViewer): Filter<ListDoc> {
  if (viewer.userId === list.userId) return ownerFilter(list.slug, viewer)
  return { slug: list.slug, members: { $elemMatch: { profileId: viewer.profileId ?? '', role: 'editor' } } }
}

export const activityEntry = (by: string, kind: ListActivityDoc['kind'], extra: Partial<ListActivityDoc> = {}): ListActivityDoc =>
  ({ id: randomBytes(6).toString('base64url'), at: new Date(), kind, by, ...extra })

/** The `$push` that records a change (the newest ACTIVITY_KEEP are kept). */
export const pushActivity = (entry: ListActivityDoc) => ({ activity: { $each: [entry], $slice: -ACTIVITY_KEEP } })

/** How several profiles look (their page when they have one, their viewer profile otherwise), in two queries. */
export async function peopleFor(refs: ProfileRef[]): Promise<Map<string, AvatarPerson>> {
  const unique = Array.from(new Map(refs.filter((ref) => ref.profileId).map((ref) => [ref.profileId, ref])).values())
  const people = new Map<string, AvatarPerson>()
  if (unique.length === 0) return people
  const identities = await getIdentities(unique.map((ref) => ref.profileId))
  identities.forEach((identity, profileId) => people.set(profileId, identity))
  const missing = unique.filter((ref) => !people.has(ref.profileId) && ObjectId.isValid(ref.userId))
  if (missing.length) {
    const { users } = await socialDb()
    const accounts = await users.find(
      { _id: { $in: Array.from(new Set(missing.map((ref) => ref.userId))).map((id) => new ObjectId(id)) } },
      { projection: { profiles: 1 } },
    ).toArray()
    const byUser = new Map(accounts.map((account) => [String(account._id), account]))
    for (const ref of missing) {
      const profile = (byUser.get(ref.userId)?.profiles ?? []).find((entry: { id?: unknown }) => String(entry?.id) === ref.profileId)
      if (profile) {
        people.set(ref.profileId, { name: String(profile.name), color: PROFILE_COLORS.includes(profile.color) ? profile.color : PROFILE_COLORS[0], image: null, handle: null })
      }
    }
  }
  return people
}

export const UNKNOWN_PERSON: AvatarPerson = { name: '?', color: '#3f3f46', image: null, handle: null }

/** How someone who isn't (or is no longer) a member is named inside one list. */
const formerKey = (slug: string, profileId: string) => `x${createHash('sha256').update(`${slug}:${profileId}`).digest('base64url').slice(0, 9)}`

/** The list as `viewer` sees it on its page. Non-members get the titles and the owner's name, nothing else. */
export async function toListView(list: ListDoc, access: ListAccess, viewer: ListViewer | null, ownerProfileId: string): Promise<SharedListView> {
  const member = access === 'owner' || access === 'editor'
  const base: SharedListView = {
    slug: list.slug,
    title: list.title,
    description: list.description,
    ownerName: list.ownerName,
    items: list.items.map(({ id, media_type, title, poster_path }) => ({ id, media_type, title, poster_path })),
    createdAt: new Date(list.createdAt).toISOString(),
    updatedAt: new Date(list.updatedAt).toISOString(),
    visibility: visibilityOf(list),
    version: list.version ?? 0,
    role: access,
    members: [],
    memberCount: 0,
    pendingCount: 0,
    people: {},
    you: null,
    seenAt: null,
    activity: [],
  }
  if (!member || !viewer) return base

  const members = membersOf(list, ownerProfileId)
  const keyOf = new Map(members.map((entry) => [entry.profileId, entry.id]))
  const key = (profileId: string | undefined | null) => (profileId ? keyOf.get(profileId) ?? formerKey(list.slug, profileId) : null)
  const activity = (list.activity ?? []).slice(-ACTIVITY_KEEP).reverse()

  // Everyone the page may name: members, whoever added an item or made a recent change, and me.
  const refs: ProfileRef[] = members.map((entry) => ({ userId: entry.userId, profileId: entry.profileId }))
  const others = new Set<string>()
  for (const item of list.items) if (item.by && !keyOf.has(item.by)) others.add(item.by)
  for (const entry of activity) if (!keyOf.has(entry.by)) others.add(entry.by)
  if (viewer.profileId && !keyOf.has(viewer.profileId)) {
    refs.push({ userId: viewer.userId, profileId: viewer.profileId })
    others.delete(viewer.profileId)
  }
  // Former members: their account is no longer stored on the list, so look them up by profile id.
  if (others.size) {
    const { users } = await socialDb()
    const accounts = await users.find({ 'profiles.id': { $in: Array.from(others) } }, { projection: { _id: 1, 'profiles.id': 1 } }).limit(40).toArray()
    for (const account of accounts) {
      for (const profile of account.profiles ?? []) {
        if (others.has(String(profile.id))) refs.push({ userId: String(account._id), profileId: String(profile.id) })
      }
    }
  }
  const found = await peopleFor(refs)
  const people: Record<string, AvatarPerson> = {}
  for (const ref of refs) people[key(ref.profileId)!] = found.get(ref.profileId) ?? UNKNOWN_PERSON
  for (const profileId of others) if (!people[key(profileId)!]) people[key(profileId)!] = UNKNOWN_PERSON

  const me = viewer.profileId ? members.find((entry) => entry.profileId === viewer.profileId) : undefined
  const isOwner = access === 'owner'
  const now = Date.now()
  const shared = members.length > 1
  return {
    ...base,
    items: list.items.map(({ id, media_type, title, poster_path, by, added_at }) => ({
      id, media_type, title, poster_path,
      by: shared || by !== ownerProfileId ? key(by ?? ownerProfileId) : null,
      addedAt: new Date(added_at).toISOString(),
    })),
    members: members.map((entry): SharedListMember => ({
      id: entry.id,
      role: entry.role,
      you: entry.profileId === viewer.profileId,
      ...(entry.profileId === viewer.profileId ? { muted: !!entry.muted } : {}),
      joinedAt: new Date(entry.joinedAt).toISOString(),
    })),
    memberCount: members.length,
    pendingCount: isOwner ? livePending(list.pending, now).length : 0,
    people,
    you: key(viewer.profileId),
    seenAt: me ? new Date(me.lastSeenAt).toISOString() : null,
    activity: activity.map((entry): SharedListActivity => ({
      id: entry.id,
      at: new Date(entry.at).toISOString(),
      kind: entry.kind,
      by: key(entry.by),
      ...(entry.item ? { item: entry.item } : {}),
      ...(typeof entry.to === 'number' ? { to: entry.to } : {}),
      ...(typeof entry.value === 'string' ? { value: entry.value } : {}),
    })),
  }
}

/** A list read fresh and shown to `viewer` (after a change). */
export async function freshView(slug: string, viewer: ListViewer): Promise<SharedListView | null> {
  const list = await (await listsCollection()).findOne({ slug })
  if (!list) return null
  const { access, ownerProfileId } = await resolveAccess(list, viewer)
  if (access === 'none') return null
  return toListView(list, access, viewer, ownerProfileId)
}

/** A display name for a profile (its page name, or its viewer profile's name). */
export async function nameOf(ref: ProfileRef): Promise<string> {
  return (await peopleFor([ref])).get(ref.profileId)?.name ?? ''
}

const listHref = (slug: string) => `/lists/${slug}`

/**
 * "Changes in your list": one notification per list, person and 3 hours. A later change in the
 * same window adds its author to that notification ("Sami and 2 others") and marks it unread again.
 * Nobody hears about it while they mute the list or are looking at it.
 */
export async function notifyChange(list: ListDoc, actor: ProfileRef): Promise<void> {
  const members = list.members ?? []
  if (members.length < 2) return
  const now = Date.now()
  const recipients = members.filter((entry) => entry.profileId !== actor.profileId && shouldNotifyMember(entry, now))
  if (recipients.length === 0) return
  const name = await nameOf(actor)
  const key = `${list.slug}:${updateBucket(now)}`
  const { notifications } = await socialDb()
  await Promise.all(recipients.map(async (entry) => {
    const to = { userId: entry.userId, profileId: entry.profileId }
    const result = await notify({
      to,
      kind: 'list_update',
      key,
      href: listHref(list.slug),
      text: { key: 'sharedLists.inbox.changes', vars: { name, list: list.title } },
      actor,
    })
    if (result.created) return
    const event_key = eventKey('list_update', to.profileId, key)
    const date = new Date()
    const joined = await notifications.updateOne(
      { userId: to.userId, event_key, 'actors.profileId': { $ne: actor.profileId } },
      {
        $push: { actors: { $each: [{ userId: actor.userId, profileId: actor.profileId }], $position: 0, $slice: 3 } },
        $inc: { actorCount: 1 },
        $set: { actor: { userId: actor.userId, profileId: actor.profileId }, created_at: date, read: false },
      },
    )
    if (joined.matchedCount === 0) await notifications.updateOne({ userId: to.userId, event_key }, { $set: { created_at: date, read: false } })
  })).catch((error) => console.error('list_update notify failed', error))
}

/** The owner hears about every join (never folded into other notifications). */
export async function notifyJoined(list: ListDoc, joiner: ProfileRef): Promise<void> {
  const owner = await ownerRefOf(list)
  if (owner.profileId === joiner.profileId) return
  const name = await nameOf(joiner)
  await notify({
    to: owner,
    kind: 'list_update',
    key: `list_join:${list.slug}:${joiner.profileId}`,
    href: listHref(list.slug),
    text: { key: 'sharedLists.inbox.joined', vars: { name, list: list.title } },
    actor: joiner,
    push: {
      topic: 'friends',
      title: { key: 'sharedLists.push.joinedTitle' },
      body: { key: 'sharedLists.inbox.joined', vars: { name, list: list.title } },
    },
  }).catch((error) => console.error('list join notify failed', error))
}

/** Editors hear when the owner lets more people see the list. */
export async function notifyVisibility(list: ListDoc, actor: ProfileRef, from: ListVisibility, to: ListVisibility): Promise<void> {
  if (!isWidening(from, to)) return
  const editors = (list.members ?? []).filter((entry) => entry.role === 'editor' && !entry.muted && entry.profileId !== actor.profileId)
  if (editors.length === 0) return
  const name = await nameOf(actor)
  await Promise.all(editors.map((entry) => notify({
    to: { userId: entry.userId, profileId: entry.profileId },
    kind: 'list_update',
    key: `visibility:${list.slug}:${to}:${list.version ?? 0}`,
    href: listHref(list.slug),
    text: { key: to === 'link' ? 'sharedLists.inbox.visibilityLink' : 'sharedLists.inbox.visibilityFriends', vars: { name, list: list.title } },
    actor,
  }))).catch((error) => console.error('list visibility notify failed', error))
}

/** The new owner hears that the list is now theirs. */
export async function notifyOwnerChange(list: ListDoc, actor: ProfileRef, to: ProfileRef): Promise<void> {
  const name = await nameOf(actor)
  await notify({
    to,
    kind: 'list_update',
    key: `owner:${list.slug}:${to.profileId}:${list.version ?? 0}`,
    href: listHref(list.slug),
    text: { key: 'sharedLists.inbox.owner', vars: { name, list: list.title } },
    actor,
  }).catch((error) => console.error('list owner notify failed', error))
}

/** A new member, joining now. */
export const newMember = (ref: ProfileRef): ListMemberDoc => ({
  id: newMemberId(),
  userId: ref.userId,
  profileId: ref.profileId,
  role: 'editor',
  joinedAt: new Date(),
  lastSeenAt: new Date(),
})

/** A block, either way, between `ref` and the owner or anyone already in the list. */
export async function blockedWithList(ref: ProfileRef, list: ListDoc, ownerProfileId: string): Promise<boolean> {
  const people = [{ userId: list.userId, profileId: ownerProfileId }, ...(list.members ?? []).map((entry) => ({ userId: entry.userId, profileId: entry.profileId }))]
  const unique = Array.from(new Map(people.map((person) => [person.profileId, person])).values())
  for (const person of unique) if (await isBlockedEitherWay(ref, person)) return true
  return false
}

export type JoinResult = 'joined' | 'already' | 'full' | 'limit' | 'gone'

/**
 * Adds `me` to the list as an editor, in one update that also takes them off the invited list:
 * only while there's room (MAX_MEMBERS) and they aren't in yet. The owner is told.
 */
export async function joinList(stored: ListDoc, me: ProfileRef): Promise<JoinResult> {
  const list = await ensureMembers(stored)
  if (list.userId === me.userId || list.members?.some((entry) => entry.profileId === me.profileId)) return 'already'
  const collection = await listsCollection()
  const joined = await collection.countDocuments({ 'members.profileId': me.profileId, userId: { $ne: me.userId } })
  if (joined >= MAX_JOINED) return 'limit'
  const result = await collection.updateOne(
    { slug: list.slug, 'members.profileId': { $ne: me.profileId }, [`members.${MAX_MEMBERS - 1}`]: { $exists: false } },
    {
      $push: { members: newMember(me), ...pushActivity(activityEntry(me.profileId, 'join')) },
      $pull: { pending: { profileId: me.profileId } },
      $inc: { version: 1 },
      $set: { updatedAt: new Date() },
    },
  )
  if (result.modifiedCount !== 1) {
    const fresh = await collection.findOne({ slug: list.slug })
    if (!fresh) return 'gone'
    return fresh.members?.some((entry) => entry.profileId === me.profileId) ? 'already' : 'full'
  }
  await settleNotificationAction(me, { type: 'list_invite', id: list.slug }, 'accepted').catch(() => undefined)
  await notifyJoined(list, me)
  return 'joined'
}
