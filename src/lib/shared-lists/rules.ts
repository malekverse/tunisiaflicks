// Shared lists: the pure rules (who may see and edit a list, how a move reorders it, when a member
// hears about a change, how often a list page asks for news). No server imports: the API, the
// pages, the hooks and the unit tests all use the same functions.

export type ListVisibility = 'private' | 'friends' | 'link'
export type ListRole = 'owner' | 'editor'
/** What someone may do with a list. `none` is answered 404, like a list that doesn't exist. */
export type ListAccess = 'owner' | 'editor' | 'viewer' | 'none'

export const LIST_VISIBILITIES: readonly ListVisibility[] = ['private', 'friends', 'link']

export const MAX_OWNED = 50
export const MAX_JOINED = 50
export const MAX_ITEMS = 100
/** People in a list, the owner included. */
export const MAX_MEMBERS = 8
/** Friends invited by name and not answered yet. */
export const MAX_PENDING = 10
export const PENDING_DAYS = 30
/** Changes kept for "Recent changes" and the unread counts. */
export const ACTIVITY_KEEP = 40
/** A move is retried this many times when someone else changed the list meanwhile, then it's a 409. */
export const MOVE_ATTEMPTS = 4
/** Invitation links: how long they work and how many people they let in. */
export const INVITE_DAYS = 30
export const INVITE_MAX_USES = 8
/** "Changes in your list" notifications: one per list and person per 3 hours. */
export const UPDATE_BUCKET_MS = 3 * 60 * 60 * 1000
/** Someone who looked at the list this recently doesn't need to be told about a change in it. */
export const SEEN_QUIET_MS = 2 * 60 * 1000

export const isVisibility = (value: unknown): value is ListVisibility =>
  value === 'private' || value === 'friends' || value === 'link'

/** A list made before visibility existed was public to anyone with the link: it still is. */
export const visibilityOf = (list: { visibility?: unknown }): ListVisibility =>
  (isVisibility(list.visibility) ? list.visibility : 'link')

/** How open a visibility is (private < friends < link). */
const OPENNESS: Record<ListVisibility, number> = { private: 0, friends: 1, link: 2 }

/** True when `to` lets more people see the list than `from` did. */
export const isWidening = (from: ListVisibility, to: ListVisibility) => OPENNESS[to] > OPENNESS[from]

/** 'movie-550': how items are named in moves, orders and removals. */
export const itemKey = (item: { media_type: string; id: string | number }) => `${item.media_type}-${item.id}`

export const isItemKey = (value: unknown): value is string => typeof value === 'string' && /^(movie|tv)-\d{1,9}$/.test(value)

/**
 * The items with the one named `key` moved to position `to` (clamped), or null when that item
 * isn't in the list. Never adds or drops anything: the result is always a permutation.
 */
export function moveItem<T extends { media_type: string; id: string }>(items: readonly T[], key: string, to: number): T[] | null {
  const from = items.findIndex((item) => itemKey(item) === key)
  if (from < 0 || !Number.isFinite(to)) return null
  const target = Math.max(0, Math.min(items.length - 1, Math.trunc(to)))
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

/** Reorders by key; unknown keys are ignored, and anything not mentioned keeps its order at the end. */
export function reorder<T extends { media_type: string; id: string }>(items: readonly T[], order: readonly unknown[]): T[] {
  const position = new Map<string, number>()
  order.forEach((key, index) => { if (typeof key === 'string' && !position.has(key)) position.set(key, index) })
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => ((position.get(itemKey(a.item)) ?? Infinity) - (position.get(itemKey(b.item)) ?? Infinity)) || a.index - b.index)
    .map(({ item }) => item)
}

export type AccessInput = {
  list: {
    userId: string
    visibility?: unknown
    members?: readonly { profileId: string; role: ListRole }[] | null
    pending?: readonly { profileId: string }[] | null
  }
  /** The list's owner profile (stored, or adopted from the owner account's first profile). */
  ownerProfileId: string
  viewer: { userId: string; profileId: string | null; kids: boolean } | null
  /** The viewer and the owner are friends (blocks already taken into account). */
  friends: boolean
  /** A block between the viewer and the owner, either way. */
  blocked: boolean
  /** The viewer holds a working invitation link to this list. */
  invited?: boolean
}

/**
 * Who the viewer is to the list:
 * - Kids only ever see their own lists (nothing shared, nobody else's).
 * - A block with the owner, either way, hides the list completely.
 * - The owner's account owns it (as before lists were shared: every grown-up profile of it).
 * - People in the list are its owner or editors.
 * - Otherwise it's visibility: 'link' = anyone with the address, 'friends' = the owner's friends,
 *   'private' = nobody else. Someone invited by name, or holding an invitation link, may look
 *   before they join.
 */
export function accessFor({ list, ownerProfileId, viewer, friends, blocked, invited }: AccessInput): ListAccess {
  const visibility = visibilityOf(list)
  if (!viewer) return visibility === 'link' ? 'viewer' : 'none'
  if (viewer.kids) return viewer.profileId && viewer.profileId === ownerProfileId ? 'owner' : 'none'
  if (blocked) return 'none'
  if (viewer.userId === list.userId) return 'owner'
  const member = viewer.profileId ? list.members?.find((entry) => entry.profileId === viewer.profileId) : undefined
  if (member) return member.role === 'owner' ? 'owner' : 'editor'
  if (visibility === 'link') return 'viewer'
  if (visibility === 'friends' && friends) return 'viewer'
  if (viewer.profileId && list.pending?.some((entry) => entry.profileId === viewer.profileId)) return 'viewer'
  if (invited) return 'viewer'
  return 'none'
}

export const canEdit = (access: ListAccess) => access === 'owner' || access === 'editor'

/** The 3-hour window a change falls in (one "changes in your list" notification per window). */
export const updateBucket = (now: number) => Math.floor(now / UPDATE_BUCKET_MS)

/** Whether a member hears about a change: not when they muted the list or are looking at it. */
export function shouldNotifyMember(member: { muted?: boolean; lastSeenAt?: Date | string | null }, now: number): boolean {
  if (member.muted) return false
  const seen = member.lastSeenAt ? new Date(member.lastSeenAt).getTime() : 0
  return !(now - seen < SEEN_QUIET_MS)
}

/** Invitations by name older than PENDING_DAYS are dropped. */
export function livePending<T extends { at: Date | string }>(pending: readonly T[] | null | undefined, now: number): T[] {
  const cutoff = now - PENDING_DAYS * 24 * 60 * 60 * 1000
  return (pending ?? []).filter((entry) => new Date(entry.at).getTime() >= cutoff)
}

/**
 * How many titles someone else added since `seenAt` that are still in the list ("3 new").
 * `by` and `me` are whatever ids the caller uses for people.
 */
export function unreadCount(
  activity: readonly { kind: string; by: string | null; at: Date | string; item?: { media_type: string; id: string } | null }[] | null | undefined,
  items: readonly { media_type: string; id: string }[],
  me: string | null,
  seenAt: Date | string | null | undefined,
): number {
  if (!seenAt) return 0
  const since = new Date(seenAt).getTime()
  const present = new Set(items.map(itemKey))
  const counted = new Set<string>()
  for (const entry of activity ?? []) {
    if (entry.kind !== 'add' || !entry.item || entry.by === me) continue
    if (new Date(entry.at).getTime() <= since) continue
    const key = itemKey(entry.item)
    if (present.has(key)) counted.add(key)
  }
  return counted.size
}

/** The list page asks for news every 6s, then 20s, then a minute while nothing changes. */
export const POLL_STEPS_MS = [6_000, 20_000, 60_000] as const
/** And stops after half an hour without anyone touching the page (until they come back). */
export const POLL_IDLE_STOP_MS = 30 * 60 * 1000

/** The wait before the next check, given how many checks in a row found nothing new. */
export function pollDelay(quietChecks: number): number {
  if (quietChecks < 5) return POLL_STEPS_MS[0]
  if (quietChecks < 11) return POLL_STEPS_MS[1]
  return POLL_STEPS_MS[2]
}

/** Whether a list is worth watching for other people's changes. */
export const isLive = (list: { memberCount: number; pendingCount?: number }) => list.memberCount > 1 || (list.pendingCount ?? 0) > 0
