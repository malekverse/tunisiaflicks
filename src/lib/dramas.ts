// The drama hubs' data, from TMDB: each shelf of a hub, the new-episode week, and the featured
// series of the day. Everything sits in Next's data cache (episode counts a week, keyword ids a
// month, lists a day, air dates six hours), so a warm hub costs nothing. Rows that rotate do so once
// a day (Tunis time), the same for everyone. The rules themselves live in ./dramas-config.
import * as React from 'react'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { tunisDate, addDays } from '@/src/lib/hijri'
import { hash } from '@/src/lib/seed'
import { createTranslator, dateLocale, type Locale, type TKey } from '@/src/lib/i18n'
import {
  GRID_SIZE, HISTORICAL_FALLBACK_GENRE, HUBS, ROW_SIZE,
  airState, belongsToHub, chooseFeatured, chooseKeywordId, compareAir, isHangulOnly, movieBaseParams, pickHubLogo,
  pickHubTrailer, reasonFor, rotate, rotationSeed, rowMinimum, tvBaseParams,
  type AirState, type DataShelf, type FeaturedReason, type HubId,
} from '@/src/lib/dramas-config'

const HOUR = 3600
const DAY = 86400

// React's per-request memo where it exists (server components); a plain call elsewhere (scripts).
const cache: <T extends (...args: any[]) => any>(fn: T) => T = (React as any).cache ?? ((fn: any) => fn)

type Kind = 'movie' | 'tv'
type Params = Record<string, string | number | boolean | undefined>

/** A title as rows and grids need it (a TMDB list item, plus what the hub knows about it). */
export type DramaItem = {
  id: number
  media_type: Kind
  name?: string
  title?: string
  original_name?: string
  original_title?: string
  overview?: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average?: number
  vote_count?: number
  popularity?: number
  first_air_date?: string
  release_date?: string
  genre_ids?: number[]
  origin_country?: string[]
  original_language?: string
  /** New-episodes shelf: where the series is in its week. */
  air?: AirState
  /** Short shelf: the number of episodes. */
  episodes?: number
}

const titleOf = (item: { name?: string, title?: string }) => item.name || item.title || ''

/** `pages` pages of a discover query, de-duplicated, poster-less titles dropped. */
async function discover(kind: Kind, params: Params, pages: number, ttl = DAY): Promise<DramaItem[]> {
  const results = await Promise.all(Array.from({ length: pages }, (_, index) =>
    tmdbFetchSafe<{ results: any[] }>(`discover/${kind}`, { ...params, page: index + 1 }, ttl)))
  return unique(results.flatMap((data) => data?.results ?? []).filter((item) => item?.poster_path).map((item) => ({ ...item, media_type: kind })))
}

/** A title reduced to its letters: "Alıkara" and "Alikara" are the same series. */
const nameKey = (item: DramaItem) => titleOf(item).normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Each title once: by id, and by name (TMDB has a few duplicate entries; two rows of one name confuse). */
function unique(items: DramaItem[]): DramaItem[] {
  const ids = new Set<number>()
  const names = new Set<string>()
  return items.filter((item) => {
    const name = nameKey(item)
    if (ids.has(item.id) || (name && names.has(name))) return false
    ids.add(item.id)
    if (name) names.add(name)
    return true
  })
}

/** A series' full record in English (air dates, episode count). Shared by every shelf. */
const seriesDetail = (id: number, ttl = 6 * HOUR) => tmdbFetchSafe<any>(`tv/${id}`, {}, ttl)

/**
 * TMDB answers with the original Hangul when it has no translation in the UI language: those
 * titles get their English name (and overview) instead.
 */
async function readableTitles(items: DramaItem[], language: string): Promise<DramaItem[]> {
  if (language === 'en-US') return items
  return Promise.all(items.map(async (item) => {
    if (!isHangulOnly(titleOf(item))) return item
    const english = await tmdbFetchSafe<any>(`${item.media_type}/${item.id}`, {}, 7 * DAY)
    const name = english?.name || english?.title
    if (!name || isHangulOnly(name)) return item
    return { ...item, ...(item.media_type === 'tv' ? { name } : { title: name }), overview: item.overview || english.overview || '' }
  }))
}

/** The ids of a list of keyword names (looked up once a month). */
export async function resolveKeywords(words: readonly string[]): Promise<number[]> {
  const found = await Promise.all(words.map(async (word) => {
    const data = await tmdbFetchSafe<{ results: { id: number, name: string }[] }>('search/keyword', { query: word }, 30 * DAY)
    return chooseKeywordId(word, data?.results ?? [])
  }))
  return [...new Set(found.filter((id): id is number => id !== null))]
}

/** Series of the hub with an episode out in the last two days or due in the next four. */
async function newEpisodes(hub: HubId, language: string, today: string): Promise<DramaItem[]> {
  const candidates = await discover('tv', {
    ...tvBaseParams(hub, language),
    'air_date.gte': addDays(today, -2),
    'air_date.lte': addDays(today, 4),
    sort_by: 'popularity.desc',
  }, 2, 6 * HOUR)
  const details = await Promise.all(candidates.slice(0, 30).map((item) => seriesDetail(item.id)))
  return candidates.slice(0, 30)
    .map((item, index) => ({ ...item, air: airState(details[index], today) ?? undefined }))
    .filter((item): item is DramaItem & { air: AirState } => !!item.air)
    .sort((a, b) => compareAir(a.air, b.air))
}

/** This week's most popular series of the hub: TMDB's worldwide trending, topped up by popularity. */
async function trending(hub: HubId, language: string, size: number): Promise<DramaItem[]> {
  const pages = await Promise.all([1, 2, 3, 4, 5].map((page) => tmdbFetchSafe<{ results: any[] }>('trending/tv/week', { page, language }, 6 * HOUR)))
  const seen = new Set<number>()
  const found: DramaItem[] = pages.flatMap((data) => data?.results ?? [])
    .filter((item) => item?.poster_path && belongsToHub(item, hub) && !seen.has(item.id) && seen.add(item.id))
    .map((item) => ({ ...item, media_type: 'tv' as const }))
  if (found.length < size) {
    const popular = await discover('tv', { ...tvBaseParams(hub, language), sort_by: 'popularity.desc', 'vote_count.gte': HUBS[hub].votes.tv }, 1, 6 * HOUR)
    for (const item of popular) {
      if (found.length >= size) break
      if (!seen.has(item.id)) {
        seen.add(item.id)
        found.push(item)
      }
    }
  }
  return found.slice(0, size)
}

/**
 * Short series: at most `shortMaxEpisodes` episodes (counts cached a week). Long-running TV dramas
 * fill the popularity charts, so the candidates are the best-known series (most votes, where the
 * streaming platforms' short series are) plus this week's most popular.
 */
async function shortSeries(hub: HubId, language: string, pages: number): Promise<DramaItem[]> {
  const base = { ...tvBaseParams(hub, language), 'vote_count.gte': HUBS[hub].votes.tv }
  const [known, popular] = await Promise.all([
    discover('tv', { ...base, sort_by: 'vote_count.desc' }, pages + 2, 7 * DAY),
    discover('tv', { ...base, sort_by: 'popularity.desc' }, 1),
  ])
  const candidates = unique([...popular, ...known])
  const details = await Promise.all(candidates.map((item) => seriesDetail(item.id, 7 * DAY)))
  return candidates.flatMap((item, index) => {
    const episodes = details[index]?.number_of_episodes
    return typeof episodes === 'number' && episodes > 0 && episodes <= HUBS[hub].shortMaxEpisodes ? [{ ...item, episodes }] : []
  })
}

async function shelfPool(hub: HubId, shelf: Exclude<DataShelf, 'new-episodes' | 'trending'>, language: string, pages: number): Promise<DramaItem[]> {
  const config = HUBS[hub]
  const series = tvBaseParams(hub, language)
  const rated = { 'vote_average.gte': 6.5, 'vote_count.gte': config.votes.tv, sort_by: 'popularity.desc' }
  switch (shelf) {
    case 'favourites':
      return discover('tv', { ...series, sort_by: 'vote_average.desc', 'vote_count.gte': config.votes.favourites, 'vote_average.gte': config.favouritesMinRating }, pages)
    case 'romance': {
      const ids = await resolveKeywords(config.keywords.romance)
      return ids.length ? discover('tv', { ...series, ...rated, with_keywords: ids.join('|') }, pages) : []
    }
    case 'historical': {
      const ids = await resolveKeywords(config.keywords.historical)
      return ids.length ? discover('tv', { ...series, ...rated, with_keywords: ids.join('|') }, pages) : []
    }
    case 'thrillers':
      return discover('tv', { ...series, ...rated, with_genres: '80|9648' }, pages)
    case 'short':
      return shortSeries(hub, language, pages)
    case 'films':
      return discover('movie', { ...movieBaseParams(hub, language), sort_by: 'popularity.desc', 'vote_count.gte': config.votes.movie }, pages)
  }
}

/**
 * One shelf of a hub, in the viewer's language: `size` titles (a row: 20, a grid: 60). New
 * episodes and the Top 10 keep their order; the other shelves are drawn from a larger pool in the
 * day's order. Memoised per request (the page and its rows ask for the same shelves).
 */
export const getShelf = cache(async (hub: HubId, shelf: DataShelf, locale: Locale, size: number = ROW_SIZE): Promise<DramaItem[]> => {
  const language = tmdbLanguage(locale)
  const today = tunisDate()
  let items: DramaItem[]
  if (shelf === 'new-episodes') items = (await newEpisodes(hub, language, today)).slice(0, size)
  else if (shelf === 'trending') items = await trending(hub, language, size)
  else {
    const pages = size > ROW_SIZE ? Math.ceil(size / 20) : 2
    const pool = await shelfPool(hub, shelf, language, pages)
    items = rotate(pool, rotationSeed(today, hub, shelf)).slice(0, size)
    // Too few series tagged with the history keywords: TMDB's "War & Politics" tops the row up,
    // after them.
    if (shelf === 'historical' && items.length < rowMinimum('historical')) {
      const fallback = await discover('tv', {
        ...tvBaseParams(hub, language), 'vote_average.gte': 6.5, 'vote_count.gte': HUBS[hub].votes.tv,
        sort_by: 'popularity.desc', with_genres: HISTORICAL_FALLBACK_GENRE,
      }, pages)
      items = unique([...items, ...fallback]).slice(0, size)
    }
  }
  return readableTitles(items, language)
})

/** Both hubs' new episodes this week, merged in air order (the /dramas index row). */
export async function getAllNewEpisodes(locale: Locale): Promise<{ hub: HubId, items: DramaItem[] }[]> {
  return Promise.all((['turkish', 'korean'] as const).map(async (hub) => ({ hub, items: await getShelf(hub, 'new-episodes', locale, 30) })))
}

// ---------------------------------------------------------------------------------------------
// The featured series of the day.

export type FeaturedSeries = {
  id: number
  title: string
  overview: string
  backdrop: string
  poster: string | null
  logo: { path: string, ratio: number } | null
  trailer: string | null
  year: string
  rating: number
  genres: string[]
  seasons: number | null
  reason: FeaturedReason
  /** Why it's featured today, in the viewer's language. */
  why: string
}

type StoredPick = { _id: string, hub: HubId, date: string, id: number, expires_at: Date }

let indexed = false

/** The memory of past picks (no repeats), or null without a database. */
async function picksCollection() {
  try {
    const { default: clientPromise } = await import('@/src/lib/mongodb')
    const collection = (await clientPromise).db().collection<StoredPick>('dramaPicks')
    if (!indexed) {
      indexed = true
      await collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
    }
    return collection
  } catch (error) {
    console.error('Drama hubs: no database, picking without memory:', error)
    return null
  }
}

const pickId = (hub: HubId, date: string) => `${hub}:${date}`

/** The series featured on `date`: stored by the first request of the day, never one of the last two weeks'. */
async function choosePick(hub: HubId, date: string, candidates: { id: number, reason: FeaturedReason }[]): Promise<number | null> {
  const collection = await picksCollection()
  const stored = await collection?.findOne({ _id: pickId(hub, date) }).catch(() => null)
  if (stored) return stored.id

  const seed = rotationSeed(date, hub, 'featured')
  let recent = new Set<number>()
  if (collection) {
    const history = await collection.find({ hub, date: { $gte: addDays(date, -14), $lt: date } }, { projection: { id: 1 } }).toArray().catch(() => [])
    recent = new Set(history.map((entry) => entry.id))
  } else {
    // No memory: at least not yesterday's (the same rule run for yesterday).
    const yesterday = chooseFeatured(candidates, rotationSeed(addDays(date, -1), hub, 'featured'), new Set())
    if (yesterday) recent.add(yesterday.id)
  }
  const winner = chooseFeatured(candidates, seed, recent)
  if (!winner || !collection) return winner?.id ?? null
  const doc: StoredPick = { _id: pickId(hub, date), hub, date, id: winner.id, expires_at: new Date(Date.parse(`${date}T00:00:00Z`) + 30 * DAY * 1000) }
  try {
    // Two first requests at once: the first stored wins, for both.
    const saved = await collection.findOneAndUpdate({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true, returnDocument: 'after' })
    return (saved as any)?.value?.id ?? (saved as any)?.id ?? winner.id
  } catch {
    return winner.id
  }
}

function formatDay(date: string, locale: Locale) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** The reason, as a sentence in the viewer's language. */
export function describeReason(reason: FeaturedReason, hub: HubId, locale: Locale): string {
  const t = createTranslator(locale)
  switch (reason.type) {
    case 'premiere': return t('dramas.why.premiere', { season: reason.season })
    case 'new': return t('dramas.why.new', { date: formatDay(reason.date, locale) })
    case 'airing': return reason.date === tunisDate() ? t('dramas.why.airingToday') : t('dramas.why.airing', { date: formatDay(reason.date, locale) })
    case 'justAired': return t('dramas.why.justAired', { episode: reason.episode })
    case 'trending': return t('dramas.why.trending', { rank: reason.rank })
    case 'favourite': return t(`dramas.why.favourite.${hub}` as TKey)
    case 'popular': return t('dramas.why.popular')
  }
}

/**
 * The series at the top of a hub today: from this week's Top 10 and the all-time favourites, the
 * one with the best reason (a season just started, on air this week, the charts, a classic), not
 * one featured in the last two weeks. Null when TMDB gives nothing.
 */
export const getFeatured = cache(async (hub: HubId, locale: Locale): Promise<FeaturedSeries | null> => {
  const today = tunisDate()
  const [top, favourites] = await Promise.all([getShelf(hub, 'trending', locale, 10), getShelf(hub, 'favourites', locale)])
  const seen = new Set<number>()
  const pool = [...top, ...favourites.slice(0, 10)].filter((item) => item.backdrop_path && !seen.has(item.id) && seen.add(item.id))
  if (pool.length === 0) return null

  const details = await Promise.all(pool.map((item) => seriesDetail(item.id)))
  const favouriteIds = new Set(favourites.map((item) => item.id))
  const candidates = pool.map((item, index) => {
    const rank = top.findIndex((entry) => entry.id === item.id)
    return { id: item.id, reason: reasonFor(details[index], { today, trendingRank: rank >= 0 ? rank + 1 : null, favourite: favouriteIds.has(item.id) }) }
  })
  const id = await choosePick(hub, today, candidates)
  if (id === null) return null

  const language = tmdbLanguage(locale)
  const imageLanguages = hub === 'turkish' ? 'en,null,tr' : 'en,null'
  const [data, english] = await Promise.all([
    tmdbFetchSafe<any>(`tv/${id}`, { language, append_to_response: 'images,videos', include_image_language: imageLanguages, include_video_language: `en,${HUBS[hub].language},null` }, DAY),
    language === 'en-US' ? null : seriesDetail(id),
  ])
  if (!data?.backdrop_path) return null

  const index = candidates.findIndex((candidate) => candidate.id === id)
  const reason = index >= 0 ? candidates[index].reason : reasonFor(english ?? data, { today })
  const name = isHangulOnly(data.name) && english?.name ? english.name : data.name || english?.name || ''
  return {
    id,
    title: name,
    overview: data.overview || english?.overview || '',
    backdrop: data.backdrop_path,
    poster: data.poster_path ?? null,
    logo: pickHubLogo(data.images?.logos, hub),
    trailer: pickHubTrailer(data.videos?.results, hub),
    year: (data.first_air_date || '').slice(0, 4),
    rating: data.vote_average || 0,
    genres: (data.genres ?? []).slice(0, 3).map((genre: any) => genre.name),
    seasons: data.number_of_seasons || null,
    reason,
    why: describeReason(reason, hub, locale),
  }
})

/**
 * A backdrop for a hub's door (home shelf, cross-links): one popular series a day, from a single
 * cached request.
 */
export async function hubPicture(hub: HubId): Promise<string | null> {
  const data = await tmdbFetchSafe<{ results: any[] }>('discover/tv', { ...tvBaseParams(hub, 'en-US'), sort_by: 'popularity.desc', 'vote_count.gte': HUBS[hub].votes.tv }, DAY)
  const usable = (data?.results ?? []).filter((item) => item.backdrop_path).slice(0, 10)
  if (usable.length === 0) return null
  return usable[hash(rotationSeed(tunisDate(), hub, 'door')) % usable.length].backdrop_path
}

export { GRID_SIZE, ROW_SIZE }

// ---------------------------------------------------------------------------------------------
// Share cards.

/**
 * A hub's share card (what a link to /dramas/turkish looks like in WhatsApp): English words over a
 * wall of the hub's most popular posters, lit in its accent. The shape of a SHARE_SECTIONS entry
 * (lib/share-sections.ts), so it can be registered there as 'dramas-turkish' / 'dramas-korean'.
 */
export function dramaShareSection(hub: HubId | 'index') {
  const t = createTranslator('en')
  const hubs: HubId[] = hub === 'index' ? ['turkish', 'korean'] : [hub]
  return {
    title: hub === 'index' ? t('dramas.index.title') : t(`dramas.${hub}.title` as TKey),
    subtitle: hub === 'index' ? t('dramas.index.subtitle') : t(`dramas.${hub}.subtitle` as TKey),
    cta: 'Start watching',
    glow: HUBS[hub === 'index' ? 'turkish' : hub].accent,
    posters: async () => {
      const lists = await Promise.all(hubs.map((id) => getShelf(id, 'trending', 'en', 12)))
      // Interleaved, so the index card shows both hubs.
      const mixed = Array.from({ length: 12 }, (_, index) => lists.map((list) => list[index])).flat()
      return mixed
        .filter((item): item is DramaItem => !!item?.poster_path)
        .slice(0, 12)
        .map((item) => `https://image.tmdb.org/t/p/w342${item.poster_path}`)
    },
  }
}
