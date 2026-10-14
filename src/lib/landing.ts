// What the landing page (/about) shows: the site's own pictures of today, so the page a newcomer
// reads is a live trailer of the site rather than a brochure. Every source is optional and bounded
// (withTimeout): a slow one leaves its corner with fewer pictures, never holds the page.
//
// The lists go through the viewer's filters (Kids profiles, Halal mode) like any page's.
import 'server-only'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { fetchList } from '@/src/lib/kids'
import { getTunisianTitles } from '@/src/lib/tunisian'
import { arabRamadanSeries, ramadanSeasons, ramadanStatus, tunisianRamadanSeries } from '@/src/lib/ramadan'
import { getShelf } from '@/src/lib/dramas'
import { getArabMapIndex } from '@/src/lib/arab-cinema'
import { getAnimeRow, animeViewer } from '@/src/lib/anime/server'
import { MAP_CELLS, intensity } from '@/src/lib/arab-map'
import { hiddenTitles } from '@/src/lib/halal'
import { titleRef } from '@/src/lib/halal-rules'
import { getTvHub } from '@/src/lib/tunisian-tv/read'
import { youtubeThumb } from '@/src/lib/youtube'
import { withTimeout } from '@/src/lib/with-timeout'
import type { Locale } from '@/src/lib/i18n/locales'
import type { LandingData, Pic, ReelId } from '@/src/lib/landing-model'

const BUDGET_MS = 3500

type Item = Record<string, any>

const titleOf = (item: Item): string => item.title || item.name || item.original_title || item.original_name || ''

/** TMDB list items as pictures (posters only), without repeats. */
function pics(items: Item[] | null | undefined, count: number): Pic[] {
  const seen = new Set<string>()
  const out: Pic[] = []
  for (const item of items ?? []) {
    if (!item?.poster_path || seen.has(item.poster_path)) continue
    seen.add(item.poster_path)
    out.push({ title: titleOf(item), tmdb: item.poster_path })
    if (out.length === count) break
  }
  return out
}

const results = (json: { results?: Item[] } | null | undefined) => json?.results ?? []

/** The landing page's pictures for this viewer. Never throws. */
export async function getLandingData({ locale, kids, halal }: { locale: Locale, kids: boolean, halal: boolean }): Promise<LandingData> {
  const language = tmdbLanguage(locale)
  const bounded = <T,>(work: Promise<T>, fallback: T) => withTimeout(work.catch(() => fallback), BUDGET_MS, fallback)

  const latestRamadan = ramadanSeasons(new Date(), 1)[0] ?? null
  const status = ramadanStatus()

  const [
    trendingMovies, trendingShows, trendingWeekMovies, trendingWeekShows, popular2,
    tunisian, cinema, ramadanTn, ramadanArab, turkish, korean, arabIndex, anime, tvHub,
    inception, feelGood,
  ] = await Promise.all([
    bounded(fetchList('movie', 'trending', kids, 'trending/movie/day', language).then(results), [] as Item[]),
    bounded(fetchList('tv', 'trending', kids, 'trending/tv/day', language).then(results), [] as Item[]),
    bounded(fetchList('movie', 'trending', kids, 'trending/movie/week', language).then(results), [] as Item[]),
    bounded(fetchList('tv', 'trending', kids, 'trending/tv/week', language).then(results), [] as Item[]),
    bounded(kids ? Promise.resolve([] as Item[]) : tmdbFetchSafe<{ results: Item[] }>('movie/popular', { page: 2, language }).then(results), [] as Item[]),
    bounded(getTunisianTitles().then((titles) => titles ?? []), []),
    bounded(tmdbFetchSafe<{ results: Item[] }>('discover/movie', { with_origin_country: 'TN', sort_by: 'popularity.desc', language }, 86400).then(results), [] as Item[]),
    bounded(latestRamadan ? tunisianRamadanSeries(latestRamadan, locale, kids) : Promise.resolve([] as Item[]), [] as Item[]),
    bounded(latestRamadan ? arabRamadanSeries(latestRamadan, locale, kids) : Promise.resolve([] as Item[]), [] as Item[]),
    bounded(kids ? Promise.resolve([] as Item[]) : getShelf('turkish', 'trending', locale, 14) as Promise<Item[]>, [] as Item[]),
    bounded(kids ? Promise.resolve([] as Item[]) : getShelf('korean', 'trending', locale, 14) as Promise<Item[]>, [] as Item[]),
    bounded(getArabMapIndex(locale, kids), null),
    bounded(animeViewer().then((viewer) => getAnimeRow('trending', viewer)), null),
    bounded(kids ? Promise.resolve(null) : getTvHub(), null),
    bounded(kids ? Promise.resolve([] as Item[]) : tmdbFetchSafe<{ results: Item[] }>('movie/27205/recommendations', { language }, 86400).then(results), [] as Item[]),
    bounded(tmdbFetchSafe<{ results: Item[] }>('discover/movie', {
      with_genres: '35', without_genres: '27,53,80,10752', 'vote_count.gte': 3000, sort_by: 'vote_average.desc', language,
      ...(kids ? { certification_country: 'US', 'certification.lte': 'PG' } : {}),
    }, 86400).then(results), [] as Item[]),
  ])

  // The hero's wall: films and series, alternating, so neither kind takes a whole side.
  const mixed = Array.from({ length: 20 }, (_, index) => [trendingMovies[index], trendingShows[index]]).flat().filter(Boolean) as Item[]
  const wall = pics(mixed, 40)

  const tunisianPics: Pic[] = tunisian
    .filter((title) => title.poster?.startsWith('http'))
    .slice(0, 16)
    .map((title) => ({ title: title.title, src: title.poster! }))

  const ramadanPics = pics([...ramadanTn, ...ramadanArab], 12)

  const arabCountries = arabIndex?.countries ?? []
  const arabPics: Pic[] = arabCountries.flatMap((country) => (country.pick?.poster ? [{ title: country.pick.title, tmdb: country.pick.poster }] : [])).slice(0, 12)

  const animePics: Pic[] = (anime ?? []).flatMap((card) => (card.cover ? [{ title: card.title, src: card.cover }] : [])).slice(0, 12)

  const reels: { id: ReelId, pics: Pic[] }[] = [
    { id: 'movies' as const, pics: pics(trendingWeekMovies, 12) },
    { id: 'series' as const, pics: pics(trendingWeekShows, 12) },
    { id: 'anime' as const, pics: animePics },
    { id: 'turkish' as const, pics: pics(turkish, 12) },
    { id: 'korean' as const, pics: pics(korean, 12) },
    { id: 'arab' as const, pics: arabPics },
    { id: 'ramadan' as const, pics: ramadanPics },
    { id: 'tunisian' as const, pics: tunisianPics.slice(0, 12) },
  ].filter((reel) => reel.pics.length >= 4)

  // Halal mode's demo: a row of this week's titles, and which of them it hides (what's stored and
  // TMDB's facts; no AI call while the page waits). A viewer in Halal mode already gets the row
  // filtered, so nothing is left to hide there; Kids rows are kid-safe.
  const halalPool: Item[] = [
    ...trendingWeekMovies.slice(0, 10).map((item): Item => ({ ...item, media_type: 'movie' })),
    ...trendingWeekShows.slice(0, 10).map((item): Item => ({ ...item, media_type: 'tv' })),
  ].filter((item) => item.poster_path)
  const refs = halalPool.flatMap((item) => { const ref = titleRef(item, item.media_type === 'tv' ? 'tv' : 'movie'); return ref ? [ref] : [] })
  const hidden = halal || kids ? new Set<string>() : await withTimeout(hiddenTitles(refs, { grade: false }), 2500, new Set<string>())
  const isHidden = (item: Item) => hidden.has(`${item.media_type}:${item.id}`)
  const hiddenItems = halalPool.filter(isHidden).slice(0, 3)
  const keptItems = halalPool.filter((item) => !isHidden(item)).slice(0, 8 - hiddenItems.length)
  // Hidden ones spread through the row, so switching it on visibly closes gaps.
  const halalRow = keptItems.map((item) => ({ ...pics([item], 1)[0], hidden: false }))
  hiddenItems.forEach((item, index) => halalRow.splice(Math.min(halalRow.length, 1 + index * 3), 0, { ...pics([item], 1)[0], hidden: true }))

  const tvShows = (tvHub?.onAir?.length ? tvHub.onAir : tvHub?.complete ?? [])
    .flatMap((series) => {
      const cover = series.coverId ?? series.latest?.id ?? null
      return cover ? [{ title: series.titleAlt && locale !== 'en' && locale !== 'fr' ? series.titleAlt : series.title, src: youtubeThumb(cover, 'mq') }] : []
    })
    .slice(0, 6)
  const live = (tvHub?.live?.length ?? 0) > 0

  const countries = MAP_CELLS.map((cell) => {
    const country = arabCountries.find((item) => item.code === cell.code)
    return { code: cell.code, x: cell.x, y: cell.y, name: country?.name ?? cell.code.toUpperCase(), glow: intensity(country?.n) }
  })

  return {
    wall,
    reels,
    tunisia: {
      series: tunisianPics,
      tv: tvShows,
      live,
      cinema: pics(cinema, 10),
      ramadan: ramadanPics.slice(0, 8),
      countdown: status.phase === 'before'
        ? { phase: 'before', days: status.daysUntil, year: status.year }
        : { phase: 'during', day: status.day, year: status.year },
      countries,
    },
    halal: { row: halalRow, viewerOn: halal },
    swipe: pics(popular2.length ? popular2 : trendingWeekMovies, 8),
    ask: [
      { query: 'landing.ask.q1' as const, pics: pics(inception, 4) },
      { query: 'landing.ask.q2' as const, pics: pics(feelGood, 4) },
      { query: 'landing.ask.q3' as const, pics: pics(ramadanTn.length ? ramadanTn : cinema, 4) },
    ].filter((item) => item.pics.length >= 3),
    night: pics(trendingMovies.slice(3), 3),
    wrapped: pics(trendingWeekShows.slice(4), 5),
    resume: (() => {
      const show = trendingShows.find((item) => item.backdrop_path)
      return show ? { title: titleOf(show), backdrop: show.backdrop_path as string } : null
    })(),
  }
}
