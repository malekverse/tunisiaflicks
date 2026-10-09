// The weekly e-mail's Tunisian TV section: up to four series with a new episode in the week the
// e-mail covers, each linking to the episode on its channel page (/tunisian/tv/{channel}?v=…).
// Never for a Kids profile (Tunisian TV is closed to them). Pictures are our own thumbnail route,
// so the e-mail never loads anything from YouTube. Registered by integration in
// src/lib/digest/providers.ts.
import 'server-only'
import type { DigestProvider, DigestTile } from '@/src/lib/digest/providers'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { loadProfiles } from '@/src/lib/profiles'
import { SITE_URL } from '@/src/lib/seo'
import { youtubeThumb } from '@/src/lib/youtube'
import { getTvHub } from './read'
import { seriesName, tvVideoHref } from './view'

const MAX_ROWS = 4

export const tunisianTvDigestProvider: DigestProvider = {
  id: 'tunisian-tv',
  async build(ctx) {
    const profiles = await loadProfiles(ctx.userId)
    const profile = profiles.find((item) => item.id === ctx.profileId)
    if (!profile || profile.kids) return null
    const hub = await getTvHub()
    const since = ctx.since.getTime()
    const until = ctx.until.getTime()
    const arabic = isArabicScript(ctx.locale)
    const rows: DigestTile[] = hub.newEpisodes
      .filter((video) => {
        const at = Date.parse(video.publishedAt)
        return video.seriesTitle && at >= since && at < until
      })
      .slice(0, MAX_ROWS)
      .map((video) => ({
        title: seriesName(video.seriesTitle!, video.seriesTitleAlt, arabic),
        href: tvVideoHref(video.channel, video.id),
        poster: `${SITE_URL}${youtubeThumb(video.id, 'mq')}`,
        line: video.episode !== null ? ctx.t('ttv.digest.episode', { n: video.episode }) : ctx.t('ttv.digest.new'),
      }))
    if (rows.length === 0) return null
    return { type: 'rows', id: 'tunisian-tv', title: ctx.t('ttv.digest.title'), rows }
  },
}
