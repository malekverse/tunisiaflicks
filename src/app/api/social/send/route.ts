// "Send to friends" from the ShareSheet: a title (read back from TMDB, never the client's text) to
// up to 5 friends, with an optional short note. Not a chat: no replies, no read receipts.
import { notify } from '@/src/lib/notify'
import { areFriends } from '@/src/lib/social/friends'
import { resolveHandle } from '@/src/lib/social/identity'
import { mediaHref, resolveShareMedia } from '@/src/lib/social/media'
import { NOTE_MAX, cleanNote } from '@/src/lib/social/rules'
import { readJson, requireSocial, socialError, socialJson, socialRateLimit } from '@/src/lib/social/session'

export const dynamic = 'force-dynamic'

const MAX_RECIPIENTS = 5

export async function POST(request: Request) {
  const gate = await requireSocial({ needsHandle: true, write: true })
  if ('error' in gate) return gate.error
  const me = gate.ref
  const mine = gate.social!
  const body = await readJson(request)

  const to = Array.isArray(body?.to) ? Array.from(new Set(body.to.filter((h): h is string => typeof h === 'string').map((h) => h.trim().toLowerCase()))) : []
  if (to.length < 1 || to.length > MAX_RECIPIENTS) return socialError(400, 'invalid_recipients')
  const raw = body?.media as { media_type?: unknown; id?: unknown } | undefined
  const mediaType = raw?.media_type === 'movie' || raw?.media_type === 'tv' ? raw.media_type : null
  const id = typeof raw?.id === 'number' ? String(raw.id) : typeof raw?.id === 'string' ? raw.id : null
  if (!mediaType || !id) return socialError(400, 'invalid_media')
  if (body?.note !== undefined && (typeof body.note !== 'string' || body.note.length > NOTE_MAX * 2)) return socialError(400, 'invalid_note')
  const note = cleanNote(body?.note)

  const limited = await socialRateLimit([[`social:send:${me.userId}`, 30, 24 * 60 * 60]])
  if (limited) return limited
  const media = await resolveShareMedia(mediaType, id)
  if (!media) return socialError(404, 'unknown_title')

  const sent: string[] = []
  const skipped: string[] = []
  const minute = Math.floor(Date.now() / 60_000)
  for (const handle of to) {
    const friend = await resolveHandle(handle)
    if (!friend || friend.redirectTo || !(await areFriends(me.profileId, friend.profileId))) {
      skipped.push(handle)
      continue
    }
    const perRecipient = await socialRateLimit([[`social:send:${me.userId}:to:${friend.profileId}`, 10, 24 * 60 * 60]])
    if (perRecipient) {
      skipped.push(handle)
      continue
    }
    const result = await notify({
      to: { userId: friend.userId, profileId: friend.profileId },
      kind: 'title_sent',
      key: `${me.profileId}:${media.media_type}:${media.id}:${minute}`,
      href: mediaHref(media.media_type, media.id),
      text: { key: 'social.inbox.titleSent', vars: { name: mine.name, title: media.title } },
      actor: me,
      media,
      ...(note ? { note } : {}),
      merge: !note,
      push: {
        topic: 'friends',
        title: { key: 'social.push.titleSentTitle', vars: { name: mine.name } },
        body: { key: 'social.push.titleSentBody', vars: { title: media.title } },
      },
    }).catch((error) => {
      console.error('title_sent notify failed', error)
      return null
    })
    if (result?.id) sent.push(handle)
    else skipped.push(handle)
  }
  return socialJson({ sent, skipped }, sent.length ? 201 : 200)
}
