// What goes into the weekly digest, read from TMDB and the database.
//
// - The shared snapshot, once per edition and language: new this week, new Tunisian titles, the
//   moment of the calendar, sequel catch-ups and tonight's pick.
// - Each profile's own material: news from the titles the account follows, where the profile left
//   off, picks seeded by two titles it watched or loved, and what has sat on its list a while.
// Every source is bounded in time and degrades to nothing: a slow TMDB call costs a section,
// never the e-mail.
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { activeMoments, momentItems, sequelRow } from '@/src/lib/moments'
import { getPickOfTheDay } from '@/src/lib/pick-of-the-day'
import { getTunisianTitles } from '@/src/lib/tunisian'
import { addDays, tunisDate } from '@/src/lib/hijri'
import { shuffled } from '@/src/lib/seed'
import { withTimeout } from '@/src/lib/with-timeout'
import { episodeCode } from '@/src/lib/models/Follow'
import type { Locale, TKey } from '@/src/lib/i18n'
import type { Translate } from '@/src/lib/i18n/translate'
import type { Profile } from '@/src/lib/models/Profile'
import type { DigestTile } from '@/src/lib/digest/providers'
import { EMPTY_PERSONAL, type FollowNews, type PersonalParts, type SharedSnapshot } from '@/src/lib/digest/compose'
import { pictureColor } from '@/src/lib/digest/color'

type Kind = 'movie' | 'tv'
const SOURCE_TIMEOUT_MS = 8000
const KEEP = 6

const DAY = 86400000

const titleOf = (item: any) => String(item?.title || item?.name || item?.original_title || item?.original_name || '').trim()

function tmdbTile(item: any, kind: Kind, line?: string): DigestTile | null {
  const title = titleOf(item)
  if (!item?.id || !title || item.adult) return null
  return { title, href: `/${kind}/${item.id}`, poster: item.poster_path ?? null, ...(line ? { line } : {}) }
}

const kindOf = (item: any, fallback?: Kind): Kind | null => {
  const value = item?.media_type ?? fallback
  return value === 'movie' || value === 'tv' ? value : null
}

/** Movies and shows taking turns. */
function alternate<T>(a: T[], b: T[]): T[] {
  const out: T[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i])
    if (b[i]) out.push(b[i])
  }
  return out
}

// ---- Shared snapshot -------------------------------------------------------------------------

async function newThisWeek(locale: Locale, t: Translate, since: string, until: string): Promise<DigestTile[]> {
  const language = tmdbLanguage(locale)
  const [movies, shows] = await Promise.all([
    tmdbFetchSafe<{ results: any[] }>('discover/movie', {
      language, sort_by: 'popularity.desc', include_adult: false, 'vote_count.gte': 2,
      'primary_release_date.gte': since, 'primary_release_date.lte': until,
    }, 21600),
    tmdbFetchSafe<{ results: any[] }>('discover/tv', {
      language, sort_by: 'popularity.desc', include_adult: false, 'vote_count.gte': 2,
      'first_air_date.gte': since, 'first_air_date.lte': until,
      // No news, talk, reality or soap.
      without_genres: '10763,10767,10764,10766',
    }, 21600),
  ])
  let movieItems = (movies?.results ?? []).filter((item) => item.poster_path)
  if (movieItems.length < 3) {
    // A quiet week on TMDB: what's playing now.
    const playing = await tmdbFetchSafe<{ results: any[] }>('movie/now_playing', { language }, 21600)
    movieItems = (playing?.results ?? []).filter((item) => item.poster_path && (item.release_date ?? '') >= addDays(since, -14))
  }
  const movieTiles = movieItems.map((item) => tmdbTile(item, 'movie', t('digest.line.movie')))
  const showTiles = (shows?.results ?? []).filter((item) => item.poster_path).map((item) => tmdbTile(item, 'tv', t('digest.line.show')))
  return alternate(movieTiles, showTiles).filter((tile): tile is DigestTile => !!tile).slice(0, KEEP)
}

async function newTunisian(t: Translate, until: Date): Promise<DigestTile[]> {
  const titles = await getTunisianTitles()
  if (!titles) return []
  const from = until.getTime() - 14 * DAY
  return titles
    .filter((title) => {
      const published = Date.parse(title.published)
      return Number.isFinite(published) && published >= from && published <= until.getTime()
    })
    .slice(0, KEEP)
    .map((title) => ({
      title: title.title,
      href: `/tunisian/${title.slug}`,
      poster: title.poster && /^https:\/\//i.test(title.poster) ? title.poster : null,
      line: t(title.kind === 'series' ? 'digest.line.series' : 'digest.line.film'),
    }))
}

async function moment(locale: Locale, t: Translate, day: string): Promise<SharedSnapshot['moment']> {
  const current = activeMoments(false, day)[0]
  if (!current) return null
  const items = await momentItems(current.id, locale, false, 1, day)
  const tiles = items
    .map((item) => { const kind = kindOf(item); return kind ? tmdbTile(item, kind) : null })
    .filter((tile): tile is DigestTile => !!tile)
    .slice(0, KEEP)
  if (tiles.length === 0) return null
  return { id: current.id, title: t(`moment.${current.id}.title` as TKey), href: current.href, accent: current.accent, tiles }
}

async function sequels(locale: Locale, day: string): Promise<SharedSnapshot['sequels']> {
  const row = await sequelRow(locale, false, day)
  const tiles = row.items.map((item) => tmdbTile(item, 'movie')).filter((tile): tile is DigestTile => !!tile).slice(0, KEEP)
  return tiles.length && row.titles[0] ? { title: row.titles[0], tiles } : null
}

async function pick(locale: Locale, day: string): Promise<SharedSnapshot['pick']> {
  const chosen = await getPickOfTheDay(false, locale, day)
  if (!chosen?.data) return null
  const tile = tmdbTile(chosen.data, chosen.kind)
  if (!tile) return null
  return {
    tile,
    why: chosen.why ?? '',
    backdrop: chosen.data.backdrop_path ?? null,
    overview: String(chosen.data.overview ?? ''),
    color: await withTimeout(pictureColor(chosen.data.poster_path), 3000, null),
  }
}

/**
 * Everything a week shows to everyone reading in `locale`. `day` (YYYY-MM-DD) picks the moment and
 * tonight's pick. Each part is bounded; failures leave it empty.
 */
export async function buildSharedSnapshot(locale: Locale, t: Translate, { since, until, day }: { since: Date; until: Date; day: string }): Promise<SharedSnapshot> {
  const sinceDay = tunisDate(since)
  const untilDay = tunisDate(until)
  const [news, tunisian, current, catchUps, tonight] = await Promise.all([
    withTimeout(newThisWeek(locale, t, sinceDay, untilDay), SOURCE_TIMEOUT_MS, []),
    withTimeout(newTunisian(t, until), SOURCE_TIMEOUT_MS, []),
    withTimeout(moment(locale, t, day), SOURCE_TIMEOUT_MS, null),
    withTimeout(sequels(locale, day), SOURCE_TIMEOUT_MS, null),
    withTimeout(pick(locale, day), SOURCE_TIMEOUT_MS, null),
  ])
  return { newThisWeek: news, tunisian, moment: current, sequels: catchUps, pick: tonight }
}

// ---- One profile -------------------------------------------------------------------------------

type ListItem = { id: string | number; title?: string; poster_path?: string | null; media_type?: string; season?: number; episode?: number; progress?: number; added_at?: Date | string; watched_at?: Date | string }

const timeOf = (item: ListItem) => new Date((item.watched_at ?? item.added_at ?? 0) as any).getTime() || 0
const keyOf = (kind: string, id: string | number) => `/${kind}/${id}`

async function followNews(userId: string, t: Translate, since: Date, until: Date): Promise<FollowNews[]> {
  const notifications = (await clientPromise).db().collection('notifications')
  const docs = await notifications
    .find({ userId, kind: { $in: ['movie_released', 'new_episode'] }, created_at: { $gte: since, $lt: until } })
    .sort({ created_at: -1 })
    .limit(20)
    .toArray()
  const seen = new Set<string>()
  const news: FollowNews[] = []
  for (const doc of docs) {
    const kind: Kind = doc.media_type === 'tv' ? 'tv' : 'movie'
    const href = keyOf(kind, doc.tmdbId)
    if (seen.has(href) || !doc.title) continue
    seen.add(href)
    const line = doc.kind === 'new_episode' && doc.episode
      ? t('digest.line.newEpisode', { episode: episodeCode(doc.episode) })
      : t('digest.line.outNow')
    news.push({ title: String(doc.title), href, poster: doc.poster_path ?? null, line, kind })
  }
  return news.slice(0, KEEP)
}

/** The first followed title as the e-mail's hero: its picture, its story, its colour. */
async function followHero(first: FollowNews, locale: Locale, t: Translate) {
  const id = first.href.split('/')[2]
  const [detail, color] = await Promise.all([
    tmdbFetchSafe<any>(`${first.kind}/${id}`, { language: tmdbLanguage(locale) }, 86400),
    pictureColor(first.poster),
  ])
  return {
    title: titleOf(detail) || first.title,
    href: first.href,
    backdrop: detail?.backdrop_path ?? null,
    poster: first.poster,
    kicker: first.line ?? t('digest.line.outNow'),
    text: String(detail?.overview ?? ''),
    cta: t('digest.email.watch'),
    color,
  }
}

function continueWatching(history: ListItem[], t: Translate, until: Date): DigestTile[] {
  const from = until.getTime() - 60 * DAY
  return history
    .filter((item) => timeOf(item) >= from)
    .sort((a, b) => timeOf(b) - timeOf(a))
    .flatMap((item): DigestTile[] => {
      const kind = kindOf(item)
      if (!kind || !item.title) return []
      if (kind === 'tv' && Number.isInteger(item.season) && Number.isInteger(item.episode) && item.season! > 0) {
        return [{ title: item.title, href: keyOf('tv', item.id), poster: item.poster_path ?? null, line: t('digest.line.resume', { season: item.season!, episode: item.episode! }) }]
      }
      if (kind === 'movie' && typeof item.progress === 'number' && item.progress >= 5 && item.progress <= 90) {
        return [{ title: item.title, href: keyOf('movie', item.id), poster: item.poster_path ?? null, line: t('digest.line.finish') }]
      }
      return []
    })
    .slice(0, 3)
}

async function picksFrom(seeds: ListItem[], known: Set<string>, locale: Locale): Promise<DigestTile[]> {
  const language = tmdbLanguage(locale)
  const lists = await Promise.all(seeds.map(async (seed) => {
    const kind = kindOf(seed)
    if (!kind) return []
    const data = await tmdbFetchSafe<{ results: any[] }>(`${kind}/${seed.id}/recommendations`, { language }, 86400)
    return (data?.results ?? [])
      .filter((item) => item.poster_path && !item.adult)
      .map((item) => tmdbTile(item, kindOf(item, kind)!))
      .filter((tile): tile is DigestTile => !!tile && !known.has(tile.href))
  }))
  const seen = new Set<string>()
  return lists.reduce<DigestTile[]>((all, list) => alternate(all, list), [])
    .filter((tile) => !seen.has(tile.href) && seen.add(tile.href))
    .slice(0, KEEP)
}

function stillOnList(saved: ListItem[], watched: Set<string>, until: Date, seed: string): DigestTile[] {
  const before = until.getTime() - 3 * DAY
  const waiting = saved.filter((item) => {
    const kind = kindOf(item)
    return kind && item.title && !watched.has(keyOf(kind, item.id)) && timeOf(item) <= before
  })
  return shuffled(waiting, seed).slice(0, 3).map((item) => ({ title: item.title!, href: keyOf(kindOf(item)!, item.id), poster: item.poster_path ?? null }))
}

/** A profile's own sections for the week from `since` to `until`; `seed` varies the draw from week to week. */
export async function buildPersonal({ userId, profile, locale, t, since, until, seed }: {
  userId: string
  profile: Profile
  locale: Locale
  t: Translate
  since: Date
  until: Date
  seed: string
}): Promise<PersonalParts> {
  try {
    const db = (await clientPromise).db()
    const [follows, lists] = await Promise.all([
      withTimeout(followNews(userId, t, since, until), SOURCE_TIMEOUT_MS, []),
      db.collection('userContent').find({ userId, profileId: profile.id, type: { $in: ['history', 'favorites', 'saved'] } }).toArray(),
    ])
    const listOf = (type: string): ListItem[] => (lists.find((list) => list.type === type)?.items ?? []) as ListItem[]
    const history = listOf('history')
    const favorites = listOf('favorites')
    const saved = listOf('saved')

    const known = new Set<string>()
    const watched = new Set<string>()
    for (const item of history) { const kind = kindOf(item); if (kind) { known.add(keyOf(kind, item.id)); watched.add(keyOf(kind, item.id)) } }
    for (const item of [...favorites, ...saved]) { const kind = kindOf(item); if (kind) known.add(keyOf(kind, item.id)) }

    // Two seeds: the latest watched, then the latest loved.
    const seeds: ListItem[] = []
    const seedKeys = new Set<string>()
    for (const item of [...[...history].sort((a, b) => timeOf(b) - timeOf(a)), ...[...favorites].sort((a, b) => timeOf(b) - timeOf(a))]) {
      const kind = kindOf(item)
      if (!kind || seedKeys.has(keyOf(kind, item.id))) continue
      seedKeys.add(keyOf(kind, item.id))
      seeds.push(item)
      if (seeds.length === 2) break
    }

    const [hero, picks] = await Promise.all([
      follows[0] ? withTimeout(followHero(follows[0], locale, t), SOURCE_TIMEOUT_MS, null) : Promise.resolve(null),
      withTimeout(picksFrom(seeds, known, locale), SOURCE_TIMEOUT_MS, []),
    ])
    return {
      follows,
      followHero: hero,
      continueWatching: continueWatching(history, t, until),
      picks,
      stillOnList: stillOnList(saved, watched, until, `${seed}:${profile.id}`),
    }
  } catch (error) {
    console.error('Digest: building a profile failed', error)
    return EMPTY_PERSONAL
  }
}
