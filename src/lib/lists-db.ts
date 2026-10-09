// Server-side storage for lists ("My top 10 Tunisian series"), which several people can build
// together.
//
// A list belongs to one account (`userId`) and one of its profiles (`ownerProfileId`, adopted from
// the account's first profile for lists made before profiles could share). Its owner can invite
// people to edit it (`members`, at most 8), by name (`pending`) or with a link. Who may look at it
// is its `visibility`: only the people in it, the owner's friends too, or anyone with the link (a
// list made before visibility existed reads as 'link', as it always was). The URL slug is random
// and unguessable, and there is no public directory of lists.
//
// Every change is one atomic update whose filter carries the permission (see shared-lists/server):
// items are pushed and pulled in place, moves compare `version` and retry.
import { randomBytes } from 'crypto'
import clientPromise from '@/src/lib/mongodb'
import { MAX_ITEMS, MAX_OWNED, type ListRole, type ListVisibility } from '@/src/lib/shared-lists/rules'
import type { ListActivityKind } from '@/src/lib/shared-lists/types'

export const MAX_LISTS_PER_USER = MAX_OWNED
export const MAX_ITEMS_PER_LIST = MAX_ITEMS
export const MAX_TITLE = 80
export const MAX_DESCRIPTION = 300

export type ListItem = {
  id: string
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  added_at: Date
  /** The profile that added it (set for every item once the list has been opened up to others). */
  by?: string
}

export type ListMemberDoc = {
  /** Random, per list: how the browser names this person (never the profile id). */
  id: string
  userId: string
  profileId: string
  role: ListRole
  joinedAt: Date
  lastSeenAt: Date
  muted?: boolean
}

export type ListPendingDoc = {
  userId: string
  profileId: string
  /** The owner profile that sent the invitation. */
  invitedBy: string
  at: Date
}

export type ListActivityDoc = {
  id: string
  at: Date
  kind: ListActivityKind
  /** The profile that made the change. */
  by: string
  item?: { id: string; media_type: 'movie' | 'tv'; title: string; poster_path: string | null }
  to?: number
  value?: string
}

export type ListDoc = {
  slug: string
  userId: string
  ownerName: string
  title: string
  description: string
  items: ListItem[]
  createdAt: Date
  updatedAt: Date
  ownerProfileId?: string
  /** Missing on lists made before it existed: they read as 'link'. */
  visibility?: ListVisibility
  members?: ListMemberDoc[]
  pending?: ListPendingDoc[]
  activity?: ListActivityDoc[]
  /** Goes up with every change (moves compare it; the page polls with ?v=). */
  version?: number
}

let indexesReady: Promise<unknown> | null = null

export async function listsCollection() {
  const client = await clientPromise
  const collection = client.db().collection<ListDoc>('lists')
  indexesReady ??= Promise.all([
    collection.createIndex({ slug: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, updatedAt: -1 }),
    collection.createIndex({ 'members.profileId': 1, updatedAt: -1 }),
    collection.createIndex({ 'pending.profileId': 1 }),
  ]).catch(() => { indexesReady = null })
  await indexesReady
  return collection
}

export const newSlug = () => randomBytes(8).toString('base64url') // 11 chars, ~64 bits

/** A member's id inside one list (what the browser sees instead of a profile id). */
export const newMemberId = () => randomBytes(6).toString('base64url')

export const isSlug = (value: string) => /^[A-Za-z0-9_-]{6,32}$/.test(value)

export const cleanText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Validates an item coming from the client; returns null when it isn't a well-formed title. */
export function toListItem(raw: any): ListItem | null {
  const id = typeof raw?.id === 'number' ? String(raw.id) : raw?.id
  if (typeof id !== 'string' || !/^\d{1,9}$/.test(id)) return null
  if (raw.media_type !== 'movie' && raw.media_type !== 'tv') return null
  const title = cleanText(raw.title, 200)
  if (!title) return null
  const poster = typeof raw.poster_path === 'string' && /^\/[\w.-]+$/.test(raw.poster_path) ? raw.poster_path : null
  return { id, media_type: raw.media_type, title, poster_path: poster, added_at: new Date() }
}

/** Public shape (never exposes the owner's user id). */
export function toPublicList(list: ListDoc) {
  return {
    slug: list.slug,
    ownerName: list.ownerName,
    title: list.title,
    description: list.description,
    items: list.items.map(({ id, media_type, title, poster_path }) => ({ id, media_type, title, poster_path })),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  }
}

export type PublicList = ReturnType<typeof toPublicList>

export async function getListBySlug(slug: string): Promise<ListDoc | null> {
  if (!isSlug(slug)) return null
  try {
    return await (await listsCollection()).findOne({ slug })
  } catch (error) {
    console.error('Error loading list:', error)
    return null
  }
}
