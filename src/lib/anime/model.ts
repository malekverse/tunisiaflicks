// Anime: the data model, AniList's queries and the rules (pure: no I/O, so the tests check them).
//
// AniList (graphql.anilist.co, free, no key) is the anime community's own database: seasons,
// airing schedules with episode countdowns, studios, characters and their Japanese voices, the
// watch order (prequels, sequels), MyAnimeList ids. Each AniList entry is one season or film, the
// way fans count them, so episodes are numbered per entry (Frieren 1–28), not per TMDB season.
//
// Adult titles never come back (isAdult: false). Kids and Halal mode narrow it further: genres
// AniList filters for us, and themes that are a real part of the show (a tag ranked high enough)
// that we check on what comes back. A minor tag (a love subplot in an action series) doesn't count.

export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export type AnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC'
export type AnimeStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
export type TitleLanguage = 'english' | 'romaji'
export type ContentMode = { kids: boolean, halal: boolean }

/** Cookie: anime titles in English (default) or in romaji, as many fans prefer. */
export const TITLE_COOKIE = 'tf-anime-titles'

/** An anime as cards and rows show it. */
export type AnimeCard = {
  id: number
  idMal: number | null
  title: string
  /** The other names (romaji, native…) for the detail page and search. */
  altTitles: string[]
  cover: string | null
  /** AniList's dominant colour of the cover (the room light, the placeholder). */
  color: string | null
  banner: string | null
  format: AnimeFormat | null
  status: AnimeStatus | null
  episodes: number | null
  /** The next episode and when it airs (seconds since 1970), while it's airing. */
  next: { episode: number, airingAt: number } | null
  season: AnimeSeason | null
  year: number | null
  /** Out of 10 (AniList's average score / 10), like the rest of the site. */
  score: number | null
  genres: string[]
  studio: string | null
  description: string | null
  /** A YouTube trailer id. */
  trailer: string | null
}

export const ANIME_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
] as const

export const SEASONS: readonly AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
export const FORMATS: readonly AnimeFormat[] = ['TV', 'MOVIE', 'ONA', 'OVA', 'SPECIAL', 'TV_SHORT']
export const SORTS = ['POPULARITY_DESC', 'TRENDING_DESC', 'SCORE_DESC', 'START_DATE_DESC', 'FAVOURITES_DESC'] as const
export type AnimeSort = typeof SORTS[number]

// ---- content rules -----------------------------------------------------------------------------

/** A tag counts from this rank (AniList's % of how central it is to the show). */
const TAG_RANK = 60
const HALAL_GENRES = ['Ecchi', 'Hentai', 'Romance']
const HALAL_TAGS = new Set(['Nudity', 'Psychosexual', 'Ero Guro', 'Female Harem', 'Male Harem', 'Mixed Gender Harem', 'Heterosexual', "Boys' Love", 'Yuri', "Teens' Love", 'Love Triangle'])
const KIDS_GENRES = ['Ecchi', 'Hentai', 'Horror', 'Psychological', 'Thriller']
const KIDS_TAGS = new Set(['Nudity', 'Psychosexual', 'Ero Guro', 'Gore', 'Body Horror', 'Torture', 'Suicide', 'Cannibalism', 'Female Harem', 'Male Harem', 'Mixed Gender Harem'])
/** Nudity hides a title in Kids and Halal mode from a lower rank: a few scenes are enough. */
const NUDITY_RANK = 25

/** The genres AniList leaves out for this viewer (always Hentai). */
export function excludedGenres({ kids, halal }: ContentMode): string[] {
  return Array.from(new Set(['Hentai', ...(halal ? HALAL_GENRES : []), ...(kids ? KIDS_GENRES : [])]))
}

/** Whether a title's genres and tags (with ranks) are fine for this viewer. */
export function allowedFor(media: { genres?: string[] | null, tags?: { name: string, rank: number }[] | null, isAdult?: boolean | null }, mode: ContentMode): boolean {
  if (media.isAdult) return false
  const genres = media.genres ?? []
  if (excludedGenres(mode).some((genre) => genres.includes(genre))) return false
  if (!mode.kids && !mode.halal) return true
  const banned = new Set([...(mode.halal ? HALAL_TAGS : []), ...(mode.kids ? KIDS_TAGS : [])])
  return !(media.tags ?? []).some((tag) => banned.has(tag.name) && tag.rank >= (tag.name === 'Nudity' ? NUDITY_RANK : TAG_RANK))
}

// ---- seasons -----------------------------------------------------------------------------------

/** The anime season of a date (Winter = January–March …), as AniList counts them. */
export function seasonOf(date: Date): { season: AnimeSeason, year: number } {
  return { season: SEASONS[Math.floor(date.getUTCMonth() / 3)], year: date.getUTCFullYear() }
}

/** The season after (Fall 2026 → Winter 2027). */
export function nextSeason({ season, year }: { season: AnimeSeason, year: number }): { season: AnimeSeason, year: number } {
  const index = SEASONS.indexOf(season)
  return index === 3 ? { season: 'WINTER', year: year + 1 } : { season: SEASONS[index + 1], year }
}

// ---- episodes ----------------------------------------------------------------------------------

/** How many episodes are out: all of a finished show, those before the next one of an airing show. */
export function airedEpisodes(card: Pick<AnimeCard, 'status' | 'episodes' | 'next' | 'format'>): number {
  if (card.next) return Math.max(0, card.next.episode - 1)
  if (card.status === 'NOT_YET_RELEASED' || card.status === 'CANCELLED') return 0
  if (card.format === 'MOVIE') return 1
  return card.episodes ?? 0
}

// ---- reading AniList's answers -----------------------------------------------------------------

/** AniList's description as plain text: no HTML, no "(Source: …)" credit, no blank-line runs. */
export function plainDescription(html: string | null | undefined): string | null {
  if (!html) return null
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&mdash;/g, '—')
    .replace(/\(Source:[^)]*\)/gi, '')
    .replace(/\[Written by[^\]]*\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || null
}

/** One AniList media object (the CARD fragment) as a card, titles in the viewer's preference. */
export function toCard(media: any, language: TitleLanguage = 'english'): AnimeCard {
  const t = media?.title ?? {}
  const title = (language === 'english' ? t.english || t.romaji : t.romaji || t.english) || t.native || ''
  const altTitles = [t.romaji, t.english, t.native].filter((name: unknown): name is string => typeof name === 'string' && !!name && name !== title)
  const score = typeof media?.averageScore === 'number' ? media.averageScore / 10 : typeof media?.meanScore === 'number' ? media.meanScore / 10 : null
  return {
    id: media.id,
    idMal: media.idMal ?? null,
    title,
    altTitles: Array.from(new Set(altTitles)),
    cover: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    color: media.coverImage?.color ?? null,
    banner: media.bannerImage ?? null,
    format: media.format ?? null,
    status: media.status ?? null,
    episodes: media.episodes ?? null,
    next: media.nextAiringEpisode ? { episode: media.nextAiringEpisode.episode, airingAt: media.nextAiringEpisode.airingAt } : null,
    season: media.season ?? null,
    year: media.seasonYear ?? media.startDate?.year ?? null,
    score,
    genres: media.genres ?? [],
    studio: media.studios?.nodes?.[0]?.name ?? null,
    description: plainDescription(media.description),
    trailer: media.trailer?.site === 'youtube' && typeof media.trailer.id === 'string' ? media.trailer.id : null,
  }
}

/** A list of media as cards, without what this viewer shouldn't see. */
export function cardsFor(list: any[] | null | undefined, mode: ContentMode, language: TitleLanguage, limit = 20): AnimeCard[] {
  return (list ?? []).filter((media) => media && allowedFor(media, mode)).slice(0, limit).map((media) => toCard(media, language))
}

// ---- queries -----------------------------------------------------------------------------------

export const CARD_FRAGMENT = `
fragment card on Media {
  id idMal isAdult format status episodes duration season seasonYear averageScore meanScore popularity genres
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  startDate { year month day }
  nextAiringEpisode { episode airingAt }
  studios(isMain: true) { nodes { name } }
  tags { name rank }
  description(asHtml: false)
  trailer { id site }
}`

/**
 * One row of the anime home (trending, this season, all-time popular…): small requests in
 * parallel answer much faster than one big one, and each row shows as soon as it's in.
 * Variables left out (null) are no filter.
 */
export const ROW_QUERY = `
query Row($sort: [MediaSort], $season: MediaSeason, $year: Int, $format: MediaFormat, $genreNot: [String]) {
  Page(perPage: 30) { media(type: ANIME, isAdult: false, sort: $sort, season: $season, seasonYear: $year, format: $format, genre_not_in: $genreNot) { ...card } }
}
${CARD_FRAGMENT}`

export type AnimeRowKind = 'trending' | 'airing' | 'popular' | 'top' | 'upcoming' | 'movies'

/** A home row's filters, for the season it is (`now`). */
export function rowVariables(kind: AnimeRowKind, now: Date): { sort: string[], season?: AnimeSeason, year?: number, format?: AnimeFormat } {
  const season = seasonOf(now)
  const next = nextSeason(season)
  switch (kind) {
    case 'trending': return { sort: ['TRENDING_DESC'] }
    case 'airing': return { sort: ['POPULARITY_DESC'], season: season.season, year: season.year }
    case 'popular': return { sort: ['POPULARITY_DESC'] }
    case 'top': return { sort: ['SCORE_DESC'] }
    case 'upcoming': return { sort: ['POPULARITY_DESC'], season: next.season, year: next.year }
    case 'movies': return { sort: ['POPULARITY_DESC'], format: 'MOVIE' }
  }
}

/** One anime's page: the card, plus watch order, characters with their voices, recommendations, links. */
export const DETAIL_QUERY = `
query Detail($id: Int) {
  Media(id: $id, type: ANIME) {
    ...card
    synonyms countryOfOrigin source favourites
    endDate { year month day }
    relations { edges { relationType(version: 2) node { ...card type } } }
    characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
      edges { role node { id name { full } image { large } } voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { full } image { large } } }
    }
    recommendations(sort: [RATING_DESC, ID], perPage: 16) { nodes { mediaRecommendation { ...card type } } }
    externalLinks { site url type language }
    streamingEpisodes { title thumbnail }
    rankings { rank type allTime season year context }
  }
}
${CARD_FRAGMENT}`

/** The browse page: search and filters, 30 a page. */
export const BROWSE_QUERY = `
query Browse($page: Int, $search: String, $genre: [String], $season: MediaSeason, $year: Int, $format: [MediaFormat], $status: MediaStatus, $sort: [MediaSort], $genreNot: [String]) {
  Page(page: $page, perPage: 30) {
    pageInfo { hasNextPage currentPage total }
    media(type: ANIME, isAdult: false, search: $search, genre_in: $genre, season: $season, seasonYear: $year, format_in: $format, status: $status, sort: $sort, genre_not_in: $genreNot) { ...card }
  }
}
${CARD_FRAGMENT}`

/** What airs between two moments (seconds since 1970), in time order, 50 a page. */
export const SCHEDULE_QUERY = `
query Schedule($page: Int, $from: Int, $to: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { episode airingAt media { ...card countryOfOrigin } }
  }
}
${CARD_FRAGMENT}`

// ---- the players -------------------------------------------------------------------------------

export type AnimeSource = { name: string, url: string }

/**
 * The players for one episode, best first. They take AniList's id (or MyAnimeList's) and the
 * episode number of that entry, and play subtitled or dubbed. The colour is the site's red where
 * a player lets us set it. Checked in a browser (2026-10): Videasy and VidNest load the right show
 * and episode, sub and dub; VidLink answers by MyAnimeList id.
 */
export function animeSources(card: Pick<AnimeCard, 'id' | 'idMal' | 'format'>, episode: number, dub: boolean): AnimeSource[] {
  const ep = Math.max(1, Math.floor(episode))
  const lang = dub ? 'dub' : 'sub'
  const movie = card.format === 'MOVIE'
  const sources: AnimeSource[] = [
    { name: 'Videasy', url: `https://player.videasy.net/anime/${card.id}${movie ? '' : `/${ep}`}?color=ff0f00${dub ? '&dub=true' : ''}` },
    { name: 'VidNest', url: `https://vidnest.fun/anime/${card.id}/${ep}/${lang}` },
  ]
  if (card.idMal) sources.push({ name: 'VidLink', url: `https://vidlink.pro/anime/${card.idMal}/${ep}/${lang}?fallback=true&primaryColor=ff0f00` })
  return sources
}
