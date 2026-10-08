// The inbox (the bell and /notifications): release alerts for the account plus everything social
// for the profile in use. Rows waiting for an answer (a friend request, an invitation) come first.
// Kids profiles only get kid-safe release alerts and what is explicitly marked for them (badges).
import { ObjectId, type Filter } from 'mongodb'
import { alertCollections } from '@/src/lib/follows'
import { requireActiveProfile } from '@/src/lib/profiles'
import { socialDb, type SocialNotificationDoc } from '@/src/lib/social/db'
import { getIdentities } from '@/src/lib/social/identity'
import { readJson, socialError, socialJson } from '@/src/lib/social/session'
import { NOTIFICATION_FILTERS, type AvatarPerson } from '@/src/lib/social/types'
import { RELEASE_KINDS, type NotificationItem } from '@/src/lib/models/Follow'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 50

type Scope = { userId: string; profileId: string; kids: boolean }

/** What this profile may see: the account's alerts and its own rows (Kids: the kid-safe ones). */
function visibleTo(scope: Scope, filter?: string | null): Filter<SocialNotificationDoc> {
  const clauses: Filter<SocialNotificationDoc>[] = [
    { userId: scope.userId, profileId: { $in: [null, scope.profileId] } },
  ]
  if (scope.kids) {
    clauses.push({ $or: [{ kind: { $in: [...RELEASE_KINDS] }, kidSafe: true }, { kidsVisible: true }] })
  }
  if (filter && filter in NOTIFICATION_FILTERS) {
    clauses.push({ kind: { $in: NOTIFICATION_FILTERS[filter as keyof typeof NOTIFICATION_FILTERS] } })
  }
  return clauses.length === 1 ? clauses[0] : { $and: clauses }
}

async function scopeOrError() {
  const owner = await requireActiveProfile()
  if ('error' in owner) return owner
  return { scope: { userId: owner.userId, profileId: owner.profile.id, kids: owner.profile.kids } as Scope }
}

function toItem(doc: SocialNotificationDoc & { _id: ObjectId }, people: Map<string, AvatarPerson>): NotificationItem {
  const actorId = doc.actor?.profileId ?? doc.actors?.[0]?.profileId
  const actor = actorId ? people.get(actorId) ?? null : null
  const count = doc.actorCount ?? (doc.actor ? 1 : 0)
  const release = RELEASE_KINDS.includes(doc.kind)
  return {
    id: String(doc._id),
    kind: doc.kind,
    created_at: new Date(doc.created_at).toISOString(),
    read: !!doc.read,
    href: doc.href ?? (release && doc.media_type && doc.tmdbId ? `/${doc.media_type}/${doc.tmdbId}` : '/'),
    actor,
    others: Math.max(0, count - 1),
    media: doc.media ?? (release && doc.media_type && doc.tmdbId
      ? { media_type: doc.media_type, id: doc.tmdbId, title: doc.title ?? '', poster_path: doc.poster_path ?? null }
      : null),
    image: doc.image ?? null,
    note: doc.note ?? null,
    text: doc.text ?? null,
    episode: doc.episode ?? null,
    action: doc.action ?? null,
    ...(release ? { media_type: doc.media_type, tmdbId: doc.tmdbId, title: doc.title, poster_path: doc.poster_path ?? null } : {}),
  }
}

// GET ?limit=20&before=<ISO date>&filter=all|friends|alerts|nights -> { items, unread, next }
export async function GET(request: Request) {
  const result = await scopeOrError()
  if ('error' in result) return result.error
  const { scope } = result
  const params = new URL(request.url).searchParams
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), MAX_LIMIT)
  const before = params.get('before')
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null
  const filter = params.get('filter')

  await alertCollections() // the unique {userId, event_key} index and the TTL live there
  const { notifications } = await socialDb()
  const base = visibleTo(scope, filter === 'all' ? null : filter)
  const pendingFilter: Filter<SocialNotificationDoc> = { $and: [base, { 'action.state': 'pending' }] }
  const [pending, rows, unread] = await Promise.all([
    beforeDate ? [] : notifications.find(pendingFilter).sort({ created_at: -1 }).limit(20).toArray(),
    notifications.find({
      $and: [base, { 'action.state': { $ne: 'pending' } }, ...(beforeDate ? [{ created_at: { $lt: beforeDate } }] : [])],
    }).sort({ created_at: -1 }).limit(limit).toArray(),
    notifications.countDocuments({ $and: [visibleTo(scope), { read: false }] }),
  ])
  const docs = [...pending, ...rows] as (SocialNotificationDoc & { _id: ObjectId })[]
  const people = await getIdentities(docs.flatMap((doc) => [doc.actor?.profileId, doc.actors?.[0]?.profileId].filter((id): id is string => !!id)))
  const items = docs.map((doc) => toItem(doc, people))
  const next = rows.length === limit ? new Date(rows[rows.length - 1].created_at).toISOString() : null
  return socialJson({ items, unread, next })
}

// PATCH {all: true} | {ids: string[]} (no body = all): marks the visible rows read. Rows waiting
// for an answer stay pinned (their action is still pending) but stop counting as unread.
export async function PATCH(request: Request) {
  const result = await scopeOrError()
  if ('error' in result) return result.error
  const { scope } = result
  const body = await readJson(request)
  const { notifications } = await socialDb()
  const ids = Array.isArray(body?.ids)
    ? (body.ids as unknown[]).filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id)).slice(0, 200).map((id) => new ObjectId(id))
    : null
  if (body && !body.all && !ids) return socialError(400, 'invalid')
  await notifications.updateMany(
    { $and: [visibleTo(scope), { read: false }, ...(ids ? [{ _id: { $in: ids } }] : [])] },
    { $set: { read: true } },
  )
  return socialJson({ success: true })
}
