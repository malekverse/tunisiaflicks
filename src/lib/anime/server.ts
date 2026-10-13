// Anime, on the server: AniList's answers, cached (lib/anime/model has the queries and the rules).
//
// AniList allows 30 requests a minute for the whole site, so every answer is cached in Next's data
// cache, shared by everyone: the home's rows for 30 minutes (a small request each), a
// title's page for an hour, a search for 10 minutes, the week's schedule for 15. A failed or
// limited request isn't cached: the page shows what it has and the next visit asks again.
import 'server-only'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { getHalalMode, getKidsMode } from '@/src/lib/profiles'
import {
  BROWSE_QUERY, DETAIL_QUERY, ROW_QUERY, SCHEDULE_QUERY,
  TITLE_COOKIE, allowedFor, cardsFor, excludedGenres, rowVariables, toCard,
  type AnimeCard, type AnimeFormat, type AnimeRowKind, type AnimeSeason, type AnimeSort, type AnimeStatus, type ContentMode, type TitleLanguage,
} from './model'

const ENDPOINT = 'https://graphql.anilist.co'

async function post<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(9000),
  })
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.data || json.errors?.length) {
    throw new Error(`AniList ${response.status}: ${JSON.stringify(json?.errors ?? null).slice(0, 200)}`)
  }
  return json.data as T
}

/** One AniList request, cached for everyone for `revalidate` seconds. Null when AniList fails. */
async function anilist<T>(query: string, variables: Record<string, unknown>, revalidate: number): Promise<T | null> {
  const key = createHash('sha1').update(query).update(JSON.stringify(variables)).digest('hex')
  try {
    return await unstable_cache(() => post<T>(query, variables), ['anilist', key], { revalidate })()
  } catch (error) {
    console.error('AniList request failed:', error)
    return null
  }
}

// ---- the viewer --------------------------------------------------------------------------------

export type AnimeViewer = ContentMode & { language: TitleLanguage }

export async function animeViewer(): Promise<AnimeViewer> {
  const [kids, halal] = await Promise.all([getKidsMode().catch(() => false), getHalalMode().catch(() => false)])
  let language: TitleLanguage = 'english'
  try { if (cookies().get(TITLE_COOKIE)?.value === 'romaji') language = 'romaji' } catch { /* no request */ }
  return { kids, halal, language }
}

// ---- the anime home ----------------------------------------------------------------------------

/** One row of the anime home, for this viewer (cached 30 minutes for everyone). Null when AniList fails. */
export async function getAnimeRow(kind: AnimeRowKind, viewer: AnimeViewer, now = new Date()): Promise<AnimeCard[] | null> {
  const data = await anilist<{ Page: { media: any[] } }>(ROW_QUERY, { ...rowVariables(kind, now), genreNot: excludedGenres(viewer) }, 1800)
  return data ? cardsFor(data.Page.media, viewer, viewer.language) : null
}

// ---- one anime ---------------------------------------------------------------------------------

export type AnimeRelation = AnimeCard & { relation: string }
export type AnimeCharacter = {
  id: number
  name: string
  image: string | null
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND'
  voice: { name: string, image: string | null } | null
}
export type AnimeDetail = {
  card: AnimeCard
  synonyms: string[]
  source: string | null
  favourites: number | null
  popularity: number | null
  duration: number | null
  country: string | null
  start: string | null
  end: string | null
  /** The watch order: prequels, sequels, side stories, films (anime only, no manga). */
  relations: AnimeRelation[]
  characters: AnimeCharacter[]
  recommendations: AnimeCard[]
  /** Where to watch it legally, and its official site. */
  links: { site: string, url: string, type: string | null }[]
  /** Episode titles and thumbnails, when AniList has them (from the official streams). */
  episodeTitles: { title: string, thumbnail: string | null }[]
  /** "#3 Most popular all time", "#1 Highest rated Fall 2026". */
  ranks: { rank: number, context: string, season: AnimeSeason | null, year: number | null, allTime: boolean }[]
  /** Kids or Halal mode doesn't show it. */
  hidden: boolean
}

const dateOf = (date: any) => (date?.year ? [date.year, date.month, date.day].filter(Boolean).map((part: number) => String(part).padStart(2, '0')).join('-') : null)

export async function getAnimeDetail(id: number, viewer: AnimeViewer): Promise<AnimeDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const data = await anilist<{ Media: any }>(DETAIL_QUERY, { id }, 3600)
  const media = data?.Media
  if (!media) return null
  const cardOf = (raw: any) => toCard(raw, viewer.language)
  const relations = (media.relations?.edges ?? [])
    .filter((edge: any) => edge?.node?.type === 'ANIME' && allowedFor(edge.node, viewer))
    .map((edge: any) => ({ ...cardOf(edge.node), relation: String(edge.relationType ?? 'OTHER') }))
  return {
    card: cardOf(media),
    synonyms: media.synonyms ?? [],
    source: media.source ?? null,
    favourites: media.favourites ?? null,
    popularity: media.popularity ?? null,
    duration: media.duration ?? null,
    country: media.countryOfOrigin ?? null,
    start: dateOf(media.startDate),
    end: dateOf(media.endDate),
    relations,
    characters: (media.characters?.edges ?? []).filter((edge: any) => edge?.node).map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.name?.full ?? '',
      image: edge.node.image?.large ?? null,
      role: edge.role ?? 'SUPPORTING',
      voice: edge.voiceActors?.[0] ? { name: edge.voiceActors[0].name?.full ?? '', image: edge.voiceActors[0].image?.large ?? null } : null,
    })),
    recommendations: cardsFor((media.recommendations?.nodes ?? []).map((node: any) => node?.mediaRecommendation).filter((rec: any) => rec?.type === 'ANIME'), viewer, viewer.language, 16),
    links: (media.externalLinks ?? []).filter((link: any) => link?.url && (link.type === 'STREAMING' || link.site === 'Official Site'))
      .map((link: any) => ({ site: link.site, url: link.url, type: link.type ?? null })),
    episodeTitles: (media.streamingEpisodes ?? []).map((episode: any) => ({ title: episode.title ?? '', thumbnail: episode.thumbnail ?? null })),
    ranks: (media.rankings ?? []).slice(0, 4).map((rank: any) => ({ rank: rank.rank, context: rank.context, season: rank.season ?? null, year: rank.year ?? null, allTime: !!rank.allTime })),
    hidden: !allowedFor(media, viewer),
  }
}

// ---- browse and search -------------------------------------------------------------------------

export type AnimeQuery = {
  search?: string
  genre?: string
  season?: AnimeSeason
  year?: number
  format?: AnimeFormat
  status?: AnimeStatus
  sort?: AnimeSort
  page?: number
}

export async function browseAnime(query: AnimeQuery, viewer: AnimeViewer): Promise<{ items: AnimeCard[], hasNext: boolean, total: number } | null> {
  const search = query.search?.trim().slice(0, 80) || undefined
  const data = await anilist<{ Page: { pageInfo: any, media: any[] } }>(BROWSE_QUERY, {
    page: Math.min(Math.max(query.page ?? 1, 1), 50),
    search,
    genre: query.genre ? [query.genre] : undefined,
    season: query.season,
    year: query.year,
    format: query.format ? [query.format] : undefined,
    status: query.status,
    sort: search && !query.sort ? ['SEARCH_MATCH'] : [query.sort ?? 'POPULARITY_DESC'],
    genreNot: excludedGenres(viewer),
  }, search ? 600 : 1800)
  if (!data) return null
  return {
    items: cardsFor(data.Page.media, viewer, viewer.language, 30),
    hasNext: !!data.Page.pageInfo?.hasNextPage,
    total: data.Page.pageInfo?.total ?? 0,
  }
}

// ---- the week's schedule -----------------------------------------------------------------------

export type AiringSlot = { card: AnimeCard, episode: number, airingAt: number }

/** Everything that airs in the 7 days from the start of `from`'s hour (Japanese, Chinese and Korean animation). */
export async function getSchedule(viewer: AnimeViewer, from = new Date()): Promise<AiringSlot[] | null> {
  const start = Math.floor(from.getTime() / 3_600_000) * 3600 - 86400   // from yesterday: today in every time zone
  const end = start + 8 * 86400
  const slots: AiringSlot[] = []
  for (let page = 1; page <= 6; page++) {
    const data = await anilist<{ Page: { pageInfo: any, airingSchedules: any[] } }>(SCHEDULE_QUERY, { page, from: start, to: end }, 900)
    if (!data) return page === 1 ? null : slots
    for (const slot of data.Page.airingSchedules ?? []) {
      if (!slot?.media || !allowedFor(slot.media, viewer) || excludedGenres(viewer).some((genre) => slot.media.genres?.includes(genre))) continue
      slots.push({ card: toCard(slot.media, viewer.language), episode: slot.episode, airingAt: slot.airingAt })
    }
    if (!data.Page.pageInfo?.hasNextPage) break
  }
  return slots
}
