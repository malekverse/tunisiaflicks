// The weekly digest's "Your friends this week": up to five titles friends watched or rated during
// the week the e-mail covers, as far as each of them shares it (the same feed as /friends, so the
// same rules: day only, the delay, nothing from before they shared). Nothing for Kids profiles,
// profiles without a page, or a quiet week. Integration registers it in DIGEST_PROVIDERS.
import 'server-only'
import { ObjectId } from 'mongodb'
import type { DigestProvider, DigestTile } from '@/src/lib/digest/providers'
import { digestLine, weekRows } from '@/src/app/friends/_lib/feed'
import { getFriendsActivity } from './activity'
import { socialDb } from './db'
import { mediaHref } from './media'
import { tunisDay } from './rules'

async function isGrownUpWithPage(userId: string, profileId: string) {
  if (!ObjectId.isValid(userId)) return false
  const { profiles, users } = await socialDb()
  const [page, user] = await Promise.all([
    profiles.findOne({ _id: profileId, userId }, { projection: { _id: 1 } }),
    users.findOne({ _id: new ObjectId(userId) }, { projection: { profiles: 1 } }),
  ])
  const profile = (user?.profiles ?? []).find((entry: { id?: unknown }) => String(entry?.id) === profileId)
  return !!page && !!profile && profile.kids !== true
}

export const friendsDigestProvider: DigestProvider = {
  id: 'friends',
  async build(ctx) {
    if (!(await isGrownUpWithPage(ctx.userId, ctx.profileId))) return null
    const feed = await getFriendsActivity({ userId: ctx.userId, profileId: ctx.profileId }, { limit: 30, locale: ctx.locale })
    const rows = weekRows(feed.items, tunisDay(ctx.since), tunisDay(ctx.until))
    if (rows.length === 0) return null
    return {
      type: 'rows',
      id: 'friends',
      title: ctx.t('social.digest.title'),
      rows: rows.map((item): DigestTile => ({
        title: item.media.title,
        href: mediaHref(item.media.media_type, item.media.id),
        poster: item.media.poster_path,
        line: digestLine(ctx.t, item),
      })),
    }
  },
}
