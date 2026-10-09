// My lists.
// GET  ?editable=1&contains=movie-550 -> { lists, invitations, kids }: the account's lists and the
//      ones the profile helps build (with faces and what's new), and invitations by name. Kids only
//      get their own profile's lists. `contains` says, per list, whether that title is in it.
// POST { title, description?, visibility?, item? } -> 201 { list }: a new list, private unless asked
//      otherwise (Kids: always private). 30 an hour per account.
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import { getLocale } from '@/src/lib/i18n/server'
import { MAX_DESCRIPTION, MAX_TITLE, cleanText, listsCollection, newMemberId, newSlug, toListItem, type ListDoc, type ListItem } from '@/src/lib/lists-db'
import { readJson, socialRateLimit } from '@/src/lib/social/session'
import { resolveShareMedia } from '@/src/lib/social/media'
import { LIMIT_MESSAGES, listError, listJson, unauthorized } from '@/src/lib/shared-lists/api'
import { myLists } from '@/src/lib/shared-lists/queries'
import { MAX_OWNED, isItemKey, isVisibility } from '@/src/lib/shared-lists/rules'
import { loadListViewer, nameOf, ownerProfileOf, toListView } from '@/src/lib/shared-lists/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const viewer = await loadListViewer()
  if (!viewer) return unauthorized()
  const contains = new URL(request.url).searchParams.get('contains')
  try {
    return listJson(await myLists(viewer, { contains: isItemKey(contains) ? contains : null }))
  } catch (error) {
    console.error('Error listing lists:', error)
    return listError(500, 'failed', 'Failed to load lists')
  }
}

export async function POST(request: Request) {
  const viewer = await loadListViewer()
  if (!viewer) return unauthorized()
  const body = await readJson(request)
  if (!body) return listError(400, 'invalid', 'Invalid body')

  const title = cleanText(body.title, MAX_TITLE)
  if (!title) return listError(400, 'needs_title', 'A list needs a title')
  if (body.visibility !== undefined && !isVisibility(body.visibility)) return listError(400, 'invalid_visibility')

  const limited = await socialRateLimit([[`lists:create:${viewer.userId}`, 30, 60 * 60]])
  if (limited) return limited

  try {
    const collection = await listsCollection()
    if (await collection.countDocuments({ userId: viewer.userId }) >= MAX_OWNED) {
      return listError(400, 'limit_owned', LIMIT_MESSAGES.owned)
    }
    const ownerProfileId = viewer.profileId ?? (await ownerProfileOf({ userId: viewer.userId }))
    const session = await getServerSession(authOptions)
    const ownerName = (await nameOf({ userId: viewer.userId, profileId: ownerProfileId })) || cleanText(session?.user?.name, 60) || 'A TunisiaFlicks fan'

    // An optional first title ("New list…" from a title's page), read back from TMDB.
    let first: ListItem | null = null
    if (body.item && typeof body.item === 'object') {
      const raw = body.item as Record<string, unknown>
      const media = raw.media_type === 'movie' || raw.media_type === 'tv' ? await resolveShareMedia(raw.media_type, String(raw.id ?? ''), getLocale()) : null
      // A new list is private and only yours: when TMDB can't answer, the title you sent will do.
      first = media ? { ...media, added_at: new Date() } : toListItem(raw)
      if (first) first.by = ownerProfileId
    }

    const now = new Date()
    const list: ListDoc = {
      slug: newSlug(),
      userId: viewer.userId,
      ownerProfileId,
      ownerName,
      title,
      description: cleanText(body.description, MAX_DESCRIPTION),
      items: first ? [first] : [],
      createdAt: now,
      updatedAt: now,
      visibility: viewer.kids ? 'private' : isVisibility(body.visibility) ? body.visibility : 'private',
      members: [{ id: newMemberId(), userId: viewer.userId, profileId: ownerProfileId, role: 'owner', joinedAt: now, lastSeenAt: now }],
      pending: [],
      activity: [],
      version: 0,
    }
    await collection.insertOne(list)
    return listJson({ list: await toListView(list, 'owner', viewer, ownerProfileId) }, 201)
  } catch (error) {
    console.error('Error creating list:', error)
    return listError(500, 'failed', 'Failed to create list')
  }
}
