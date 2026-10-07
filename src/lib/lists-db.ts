// Server-side storage for shareable lists ("My top 10 Tunisian series").
//
// A list belongs to one account and is public to anyone who has its link: the URL slug is random
// and unguessable, and there is no public directory of lists.
import { randomBytes } from 'crypto'
import clientPromise from '@/src/lib/mongodb'

export const MAX_LISTS_PER_USER = 50
export const MAX_ITEMS_PER_LIST = 100
export const MAX_TITLE = 80
export const MAX_DESCRIPTION = 300

export type ListItem = {
  id: string
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  added_at: Date
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
}

let indexesReady: Promise<unknown> | null = null

export async function listsCollection() {
  const client = await clientPromise
  const collection = client.db().collection<ListDoc>('lists')
  indexesReady ??= Promise.all([
    collection.createIndex({ slug: 1 }, { unique: true }),
    collection.createIndex({ userId: 1, updatedAt: -1 }),
  ]).catch(() => { indexesReady = null })
  await indexesReady
  return collection
}

export const newSlug = () => randomBytes(8).toString('base64url') // 11 chars, ~64 bits

export const isSlug = (value: string) => /^[A-Za-z0-9_-]{6,32}$/.test(value)

export const cleanText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Validates an item coming from the client; returns null when it isn't a well-formed title. */
export function toListItem(raw: any): ListItem | null {
  const id = typeof raw?.id === 'number' ? String(raw.id) : raw?.id
  if (typeof id !== 'string' || !/^\d+$/.test(id)) return null
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
