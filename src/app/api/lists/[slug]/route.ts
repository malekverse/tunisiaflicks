// One list.
// GET ?v=N    -> { list } as the viewer may see it; 204 when it is still at version N (the page's
//               polling). Who may look is checked first, so a 204 never says a list exists.
// PATCH       -> { list }. One change per request (title and description may go together):
//   { title?, description? }       owner or editor
//   { add: { media_type, id } }    owner or editor; the title is read back from TMDB
//   { remove: { media_type, id } } owner or editor
//   { move: { key, to } }          owner or editor ('movie-550' to position `to`; retried, then 409)
//   { order: [key, ...] }          owner or editor (the whole order; retried, then 409)
//   { visibility }                 owner only ('private' | 'friends' | 'link')
//   600 an hour per account. A 409 {code:'conflict', list} carries the list as it is now.
// DELETE      -> owner only.
// Missing, hidden by visibility or by a block: 404, always the same.
import { getLocale } from '@/src/lib/i18n/server'
import { revokeInvites } from '@/src/lib/invites'
import { MAX_DESCRIPTION, MAX_TITLE, cleanText, getListBySlug, isSlug, listsCollection, toListItem, type ListDoc, type ListItem } from '@/src/lib/lists-db'
import { readJson, socialRateLimit } from '@/src/lib/social/session'
import { resolveShareMedia } from '@/src/lib/social/media'
import { forbidden, kidsOnly, LIMIT_MESSAGES, listError, listJson, listNotFound, ownerOnly, unauthorized } from '@/src/lib/shared-lists/api'
import { MAX_ITEMS, MOVE_ATTEMPTS, canEdit, isItemKey, isVisibility, itemKey, moveItem, reorder, visibilityOf } from '@/src/lib/shared-lists/rules'
import {
  activityEntry, editFilter, ensureMembers, freshView, loadListViewer, notifyChange, notifyVisibility, ownerFilter, pushActivity,
  resolveAccess, toListView, type ListViewer,
} from '@/src/lib/shared-lists/server'

export const dynamic = 'force-dynamic'

type Params = { params: { slug: string } }

export async function GET(request: Request, { params }: Params) {
  const list = await getListBySlug(params.slug)
  if (!list) return listNotFound()
  const viewer = await loadListViewer()
  const { access, ownerProfileId } = await resolveAccess(list, viewer)
  if (access === 'none') return listNotFound()
  const since = new URL(request.url).searchParams.get('v')
  if (since !== null && /^\d+$/.test(since) && Number(since) === (list.version ?? 0)) {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
  }
  return listJson({ list: await toListView(list, access, viewer, ownerProfileId) })
}

const OPS = ['title', 'description', 'add', 'remove', 'move', 'order', 'visibility'] as const

/** A change that wrote nothing: say why (gone, no longer allowed), or hand back the list as it is. */
async function unchanged(slug: string, viewer: ListViewer) {
  const fresh = await getListBySlug(slug)
  if (!fresh) return listNotFound()
  const { access, ownerProfileId } = await resolveAccess(fresh, viewer)
  if (access === 'none') return listNotFound()
  if (!canEdit(access)) return forbidden()
  return listJson({ list: await toListView(fresh, access, viewer, ownerProfileId) })
}

/** A compare-and-set rewrite of the order, retried while other changes land in between. */
async function rewriteOrder(slug: string, viewer: ListViewer, actor: string, next: (items: ListItem[]) => ListItem[] | null, describe: (items: ListItem[]) => { key: string; to: number } | null) {
  const collection = await listsCollection()
  for (let attempt = 0; attempt < MOVE_ATTEMPTS; attempt++) {
    const list = await collection.findOne({ slug })
    if (!list) return { status: 'gone' as const }
    const items = next(list.items)
    if (!items) return { status: 'missing' as const, list }
    if (items.every((item, index) => itemKey(item) === itemKey(list.items[index]))) return { status: 'same' as const, list }
    const moved = describe(items)
    const movedItem = moved ? items[moved.to] : null
    const result = await collection.updateOne(
      { ...editFilter(list, viewer), version: list.version ?? 0 },
      {
        $set: { items, updatedAt: new Date() },
        $inc: { version: 1 },
        $push: pushActivity(activityEntry(actor, 'move', {
          ...(movedItem ? { item: { id: movedItem.id, media_type: movedItem.media_type, title: movedItem.title, poster_path: movedItem.poster_path } } : {}),
          ...(moved ? { to: moved.to } : {}),
        })),
      },
    )
    if (result.modifiedCount === 1) return { status: 'moved' as const, list }
  }
  return { status: 'conflict' as const }
}

export async function PATCH(request: Request, { params }: Params) {
  const viewer = await loadListViewer()
  if (!viewer) return unauthorized()
  if (!isSlug(params.slug)) return listNotFound()
  const body = await readJson(request)
  if (!body) return listError(400, 'invalid', 'Invalid body')
  const ops = OPS.filter((op) => body[op] !== undefined)
  const details = ops.every((op) => op === 'title' || op === 'description')
  if (ops.length === 0 || (ops.length > 1 && !details)) return listError(400, 'one_change', 'Send one change at a time')

  const limited = await socialRateLimit([[`lists:patch:${viewer.userId}`, 600, 60 * 60]])
  if (limited) return limited

  const stored = await getListBySlug(params.slug)
  if (!stored) return listNotFound()
  const { access, ownerProfileId } = await resolveAccess(stored, viewer)
  if (access === 'none') return listNotFound()
  if (!canEdit(access)) return forbidden()

  const list = await ensureMembers(stored)
  const actor = viewer.profileId ?? ownerProfileId
  const actorRef = { userId: viewer.userId, profileId: actor }
  const collection = await listsCollection()
  const now = () => new Date()
  const done = async (changed: ListDoc | null, notifyOthers = true) => {
    if (changed && notifyOthers) await notifyChange(changed, actorRef)
    const view = await freshView(list.slug, viewer)
    return view ? listJson({ list: view }) : listNotFound()
  }

  try {
    // Title and description.
    if (details) {
      const set: Partial<ListDoc> = {}
      if (body.title !== undefined) {
        const title = cleanText(body.title, MAX_TITLE)
        if (!title) return listError(400, 'needs_title', 'A list needs a title')
        set.title = title
      }
      if (body.description !== undefined) set.description = cleanText(body.description, MAX_DESCRIPTION)
      const kind = set.title !== undefined && set.title !== list.title ? 'title' : 'description'
      const result = await collection.updateOne(editFilter(list, viewer), {
        $set: { ...set, updatedAt: now() },
        $inc: { version: 1 },
        $push: pushActivity(activityEntry(actor, kind, { value: kind === 'title' ? set.title : set.description ?? '' })),
      })
      return result.modifiedCount === 1 ? done(list) : unchanged(list.slug, viewer)
    }

    if (body.add !== undefined) {
      const raw = (body.add ?? {}) as Record<string, unknown>
      if (raw.media_type !== 'movie' && raw.media_type !== 'tv') return listError(400, 'invalid_title', 'Invalid title')
      const id = typeof raw.id === 'number' ? String(raw.id) : raw.id
      if (typeof id !== 'string' || !/^\d{1,9}$/.test(id)) return listError(400, 'invalid_title', 'Invalid title')
      if (list.items.some((item) => item.media_type === raw.media_type && item.id === id)) return unchanged(list.slug, viewer)
      if (list.items.length >= MAX_ITEMS) return listError(400, 'full', LIMIT_MESSAGES.items)
      // What others will see comes from TMDB. A list only you can see keeps working when TMDB is down.
      const media = await resolveShareMedia(raw.media_type, id, getLocale())
      const solo = (list.members?.length ?? 1) <= 1 && visibilityOf(list) === 'private'
      const fallback = !media && solo ? toListItem(raw) : null
      if (!media && !fallback) return listError(404, 'unknown_title', 'Unknown title')
      const item: ListItem = { ...(media ?? fallback!), added_at: now(), by: actor }
      const snapshot = { id: item.id, media_type: item.media_type, title: item.title, poster_path: item.poster_path }
      const result = await collection.updateOne(
        {
          ...editFilter(list, viewer),
          [`items.${MAX_ITEMS - 1}`]: { $exists: false },
          items: { $not: { $elemMatch: { id: item.id, media_type: item.media_type } } },
        },
        {
          $push: { items: item, ...pushActivity(activityEntry(actor, 'add', { item: snapshot })) },
          $inc: { version: 1 },
          $set: { updatedAt: now() },
        },
      )
      if (result.modifiedCount === 1) return done(list)
      const fresh = await getListBySlug(list.slug)
      if (fresh && !fresh.items.some((entry) => itemKey(entry) === itemKey(item)) && fresh.items.length >= MAX_ITEMS) {
        return listError(400, 'full', LIMIT_MESSAGES.items)
      }
      return unchanged(list.slug, viewer)
    }

    if (body.remove !== undefined) {
      const raw = (body.remove ?? {}) as Record<string, unknown>
      const key = `${raw.media_type}-${raw.id}`
      const item = list.items.find((entry) => itemKey(entry) === key)
      if (!item) return unchanged(list.slug, viewer)
      const result = await collection.updateOne(
        { ...editFilter(list, viewer), items: { $elemMatch: { id: item.id, media_type: item.media_type } } },
        {
          $pull: { items: { id: item.id, media_type: item.media_type } },
          $push: pushActivity(activityEntry(actor, 'remove', { item: { id: item.id, media_type: item.media_type, title: item.title, poster_path: item.poster_path } })),
          $inc: { version: 1 },
          $set: { updatedAt: now() },
        },
      )
      return result.modifiedCount === 1 ? done(list) : unchanged(list.slug, viewer)
    }

    if (body.move !== undefined || body.order !== undefined) {
      let outcome: Awaited<ReturnType<typeof rewriteOrder>>
      if (body.move !== undefined) {
        const raw = (body.move ?? {}) as Record<string, unknown>
        if (!isItemKey(raw.key) || typeof raw.to !== 'number' || !Number.isFinite(raw.to)) return listError(400, 'invalid_move', 'Invalid move')
        const key = raw.key
        const to = raw.to
        outcome = await rewriteOrder(list.slug, viewer, actor, (items) => moveItem(items, key, to), (items) => ({ key, to: items.findIndex((item) => itemKey(item) === key) }))
      } else {
        if (!Array.isArray(body.order)) return listError(400, 'invalid_order', 'Invalid order')
        const order = body.order as unknown[]
        outcome = await rewriteOrder(list.slug, viewer, actor, (items) => reorder(items, order), () => null)
      }
      if (outcome.status === 'gone') return listNotFound()
      if (outcome.status === 'conflict') {
        const view = await freshView(list.slug, viewer)
        return view ? listError(409, 'conflict', 'The list changed meanwhile', { list: view }) : listNotFound()
      }
      if (outcome.status === 'moved') return done(list)
      return unchanged(list.slug, viewer)
    }

    // Visibility: the owner's call. Kids lists stay private.
    if (body.visibility !== undefined) {
      if (!isVisibility(body.visibility)) return listError(400, 'invalid_visibility')
      if (access !== 'owner') return ownerOnly()
      if (viewer.kids) return kidsOnly()
      const from = visibilityOf(list)
      const to = body.visibility
      if (from === to && list.visibility) return done(null, false)
      const result = await collection.updateOne(ownerFilter(list.slug, viewer), {
        $set: { visibility: to, updatedAt: now() },
        $inc: { version: 1 },
        $push: pushActivity(activityEntry(actor, 'visibility', { value: to })),
      })
      if (result.modifiedCount !== 1) return unchanged(list.slug, viewer)
      await notifyVisibility({ ...list, version: (list.version ?? 0) + 1 }, actorRef, from, to)
      return done(null, false)
    }
    return listError(400, 'one_change', 'Send one change at a time')
  } catch (error) {
    console.error('Error updating list:', error)
    return listError(500, 'failed', 'Failed to update list')
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const viewer = await loadListViewer()
  if (!viewer) return unauthorized()
  const list = await getListBySlug(params.slug)
  if (!list) return listNotFound()
  const { access } = await resolveAccess(list, viewer)
  if (access === 'none') return listNotFound()
  if (access !== 'owner') return ownerOnly()
  try {
    const result = await (await listsCollection()).deleteOne(ownerFilter(list.slug, viewer))
    if (result.deletedCount !== 1) return listNotFound()
    await revokeInvites('list', list.slug)
    return listJson({ success: true })
  } catch (error) {
    console.error('Error deleting list:', error)
    return listError(500, 'failed', 'Failed to delete list')
  }
}
