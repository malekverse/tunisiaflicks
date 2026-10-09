// POST: "I'm looking at this list now". Clears its '3 new' on /lists, and nobody's change in the
// next two minutes notifies me (I can see it happen). Members only; Kids: 403.
import { isSlug, listsCollection } from '@/src/lib/lists-db'
import { kidsOnly, listJson, listNotFound, unauthorized } from '@/src/lib/shared-lists/api'
import { loadListViewer } from '@/src/lib/shared-lists/server'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: { slug: string } }) {
  const viewer = await loadListViewer()
  if (!viewer?.profileId) return unauthorized()
  if (viewer.kids) return kidsOnly()
  if (!isSlug(params.slug)) return listNotFound()
  const result = await (await listsCollection()).updateOne(
    { slug: params.slug, 'members.profileId': viewer.profileId },
    { $set: { 'members.$.lastSeenAt': new Date() } },
  )
  // Not a member (or an older list nobody joined): nothing to remember, and nothing to say.
  if (result.matchedCount !== 1) return listNotFound()
  return listJson({ success: true })
}
