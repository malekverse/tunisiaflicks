// My shows (/shows) on the server: the series in a profile's watch history (the last episode played
// of each), against what TMDB says has aired and what comes next (lib/tracker has the rules).
// TMDB answers are cached (a show for 6 hours, a season for a day), so the page costs one database
// read and mostly cached fetches.
import 'server-only'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import type { Locale } from '@/src/lib/i18n/locales'
import { progress, shelfOrder, type Aired, type Episode, type Progress, type ShowFacts } from '@/src/lib/tracker'

/** How many shows the page follows (the most recently watched). */
const MAX_SHOWS = 40
const SHOW_TTL = 6 * 3600
const SEASON_TTL = 86400

export type NextEpisode = { name: string | null, still_path: string | null, runtime: number | null, air_date: string | null }

export type TrackedShow = {
  id: string
  title: string
  poster_path: string | null
  backdrop_path: string | null
  watched: Episode
  watchedAt: number
  progress: Progress
  /** The episode scheduled next (TMDB), when there is a date. */
  scheduled: (Aired & { name: string | null }) | null
  /** The episode to play next, when it has aired (its name and still). */
  upNext: NextEpisode | null
}

type HistoryItem = { id?: unknown, media_type?: unknown, season?: unknown, episode?: unknown, watched_at?: unknown, title?: unknown, poster_path?: unknown }

const isNumber = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0

/** The series in a profile's history, newest first, once each, with the episode last played. */
async function watchedShows(userId: string, profileId: string): Promise<{ id: string, watched: Episode, watchedAt: number, title: string, poster_path: string | null }[]> {
  const db = (await clientPromise).db()
  const doc = await db.collection('userContent').findOne({ userId, profileId, type: 'history' }, { projection: { items: 1 } })
  const seen = new Set<string>()
  const shows = []
  for (const item of ((doc?.items ?? []) as HistoryItem[])) {
    if (item.media_type !== 'tv' || !isNumber(item.season) || !isNumber(item.episode)) continue
    const id = typeof item.id === 'number' ? String(item.id) : typeof item.id === 'string' && /^\d{1,9}$/.test(item.id) ? item.id : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    const at = item.watched_at ? new Date(item.watched_at as string).getTime() : 0
    shows.push({
      id,
      watched: { season: item.season, episode: item.episode },
      watchedAt: Number.isFinite(at) ? at : 0,
      title: typeof item.title === 'string' ? item.title : '',
      poster_path: typeof item.poster_path === 'string' ? item.poster_path : null,
    })
    if (shows.length >= MAX_SHOWS) break
  }
  return shows
}

/** `work` over `items`, a few at a time (TMDB answers 429 to a burst). */
async function pooled<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await work(items[index])
    }
  }))
  return out
}

const aired = (value: any): Aired | null => (value && isNumber(value.season_number) && isNumber(value.episode_number)
  ? { season: value.season_number, episode: value.episode_number, air_date: typeof value.air_date === 'string' && value.air_date ? value.air_date : null }
  : null)

/** Every show in the profile's history, with where they are in it. */
export async function getTrackedShows(owner: { userId: string, profileId: string }, locale: Locale, now = Date.now()): Promise<TrackedShow[]> {
  const shows = await watchedShows(owner.userId, owner.profileId)
  if (!shows.length) return []
  const language = catalogueLanguage(locale)

  const tracked = await pooled(shows, 6, async (show): Promise<TrackedShow | null> => {
    const data = await tmdbFetchSafe<any>(`tv/${show.id}`, { language }, SHOW_TTL)
    if (!data?.id) return null
    const next = aired(data.next_episode_to_air)
    const facts: ShowFacts = {
      seasons: (data.seasons ?? []).filter((season: any) => isNumber(season?.season_number) && isNumber(season?.episode_count)),
      last: aired(data.last_episode_to_air),
      next,
      status: String(data.status ?? ''),
    }
    const result = progress(facts, show.watched, now)
    return {
      id: show.id,
      title: String(data.name || data.original_name || show.title),
      poster_path: data.poster_path ?? show.poster_path,
      backdrop_path: data.backdrop_path ?? null,
      watched: show.watched,
      watchedAt: show.watchedAt,
      progress: result,
      scheduled: next?.air_date ? { ...next, name: data.next_episode_to_air?.name || null } : null,
      upNext: null,
    }
  })
  const list = tracked.filter((show): show is TrackedShow => !!show)

  // The episode to play next: its name and still (one season fetch per show you're catching up on).
  const behind = list.filter((show) => show.progress.upNext).slice(0, 20)
  await pooled(behind, 6, async (show) => {
    const { season, episode } = show.progress.upNext!
    const data = await tmdbFetchSafe<any>(`tv/${show.id}/season/${season}`, { language }, SEASON_TTL)
    const found = (data?.episodes ?? []).find((item: any) => item?.episode_number === episode)
    show.upNext = found
      ? { name: found.name || null, still_path: found.still_path ?? null, runtime: isNumber(found.runtime) ? found.runtime : null, air_date: found.air_date || null }
      : { name: null, still_path: null, runtime: null, air_date: null }
  })

  return list.sort((a, b) => shelfOrder(
    { shelf: a.progress.shelf, watchedAt: a.watchedAt, nextAir: a.scheduled?.air_date ?? null },
    { shelf: b.progress.shelf, watchedAt: b.watchedAt, nextAir: b.scheduled?.air_date ?? null },
  ))
}
