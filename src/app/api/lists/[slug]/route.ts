// One list. GET is public (anyone with the link); PATCH and DELETE are owner-only.
//
// PATCH body (any combination):
//   { title?, description?, add?: item, remove?: { id, media_type }, order?: ["movie-550", "tv-1399", ...] }
import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import {
  MAX_DESCRIPTION, MAX_ITEMS_PER_LIST, MAX_TITLE, cleanText, getListBySlug, isSlug, listsCollection, toListItem, toPublicList,
} from '@/src/lib/lists-db'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'private, no-store' }
const keyOf = (item: { media_type: string, id: string }) => `${item.media_type}-${item.id}`

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const list = await getListBySlug(params.slug)
  if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 })
  return NextResponse.json({ list: toPublicList(list) }, { headers: noStore })
}

/** Loads the list and checks the signed-in user owns it. */
async function ownedList(slug: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!isSlug(slug)) return { error: NextResponse.json({ error: 'List not found' }, { status: 404 }) }
  const list = await getListBySlug(slug)
  // Same answer for "missing" and "not yours", so other people's slugs can't be probed.
  if (!list || list.userId !== session.user.id) return { error: NextResponse.json({ error: 'List not found' }, { status: 404 }) }
  return { list }
}

export async function PATCH(request: NextRequest, { params }: { params: { slug: string } }) {
  const owned = await ownedList(params.slug)
  if ('error' in owned) return owned.error
  const { list } = owned

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const update: Record<string, any> = {}
  let items = [...list.items]

  if (body.title !== undefined) {
    const title = cleanText(body.title, MAX_TITLE)
    if (!title) return NextResponse.json({ error: 'A list needs a title' }, { status: 400 })
    update.title = title
  }
  if (body.description !== undefined) update.description = cleanText(body.description, MAX_DESCRIPTION)

  if (body.add !== undefined) {
    const item = toListItem(body.add)
    if (!item) return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
    if (!items.some((existing) => keyOf(existing) === keyOf(item))) {
      if (items.length >= MAX_ITEMS_PER_LIST) {
        return NextResponse.json({ error: `A list can hold up to ${MAX_ITEMS_PER_LIST} titles` }, { status: 400 })
      }
      items.push(item)
    }
  }
  if (body.remove !== undefined) {
    const key = `${body.remove?.media_type}-${body.remove?.id}`
    items = items.filter((existing) => keyOf(existing) !== key)
  }
  if (Array.isArray(body.order)) {
    // Reorder by key; unknown keys are ignored and anything not mentioned keeps its place at the end.
    const position = new Map<string, number>(body.order.filter((key: unknown) => typeof key === 'string').map((key: string, i: number) => [key, i]))
    items = [...items].sort((a, b) => (position.get(keyOf(a)) ?? Infinity) - (position.get(keyOf(b)) ?? Infinity))
  }

  if (body.add !== undefined || body.remove !== undefined || Array.isArray(body.order)) update.items = items
  if (Object.keys(update).length === 0) return NextResponse.json({ list: toPublicList(list) }, { headers: noStore })

  update.updatedAt = new Date()
  try {
    const collection = await listsCollection()
    await collection.updateOne({ slug: list.slug, userId: list.userId }, { $set: update })
    return NextResponse.json({ list: toPublicList({ ...list, ...update }) }, { headers: noStore })
  } catch (error) {
    console.error('Error updating list:', error)
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { slug: string } }) {
  const owned = await ownedList(params.slug)
  if ('error' in owned) return owned.error
  const { list } = owned
  try {
    await (await listsCollection()).deleteOne({ slug: list.slug, userId: list.userId })
    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (error) {
    console.error('Error deleting list:', error)
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }
}
