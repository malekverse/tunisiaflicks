// The weekly digest's movie nights section: the nights this profile hosts or is going to (or is
// still invited to) in the week ahead, each with its film's poster and when it starts. Registered
// in lib/digest/providers.ts by integration; nothing when there is no night coming up.
import 'server-only'
import type { DigestProvider } from '@/src/lib/digest/providers'
import { nightsForDigest } from './movie-night'
import { nightDay, nightTime } from './movie-night-format'

export const nightsDigestProvider: DigestProvider = {
  id: 'nights',
  build: async (ctx) => {
    const list = await nightsForDigest(ctx.profileId, ctx.until)
    if (list.length === 0) return null
    return {
      type: 'rows',
      id: 'nights',
      title: ctx.t('movieNight.digest.title'),
      rows: list.map((night) => ({
        title: night.title || (night.chosen ? ctx.t('movieNight.digest.watching', { title: night.chosen.media.title }) : ctx.t('movieNight.defaultTitle')),
        href: `/movie-night/${night._id}`,
        poster: night.chosen?.media.poster_path ?? night.candidates[0]?.media.poster_path ?? null,
        line: ctx.t('movieNight.digest.when', { day: nightDay(night.starts_at, night.tz, ctx.locale), time: nightTime(night.starts_at, night.tz, ctx.locale) }),
      })),
    }
  },
}
