// "For you" on a drama hub, for a signed-in grown-up profile: the hub's series in their watch
// history to pick up again (straight to the episode they were on), and "Because you watched X",
// TMDB's recommendations for the latest of them, kept to the hub and to what they haven't seen.
import { getActiveProfile } from '@/src/lib/profiles'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { belongsToHub, rowMinimum, type HubId } from '@/src/lib/dramas-config'
import type { DramaItem } from '@/src/lib/dramas'
import type { Locale } from '@/src/lib/i18n'

const DAY = 86400
/** How far back in the history to look for the hub's series. */
const LOOK_BACK = 30
const RESUME_MAX = 12

export type ResumeItem = {
  id: string
  title: string
  backdrop: string | null
  poster: string | null
  season: number
  episode: number
  href: string
}

export type DramasForYou = {
  resume: ResumeItem[]
  because: { seed: { id: string, title: string }, items: DramaItem[] } | null
}

const keyOf = (type: string, id: string | number) => `${type}-${id}`

/** Null for guests, Kids profiles and a device with no profile picked. */
export async function getDramasForYou(hub: HubId, locale: Locale): Promise<DramasForYou | null> {
  const active = await getActiveProfile()
  const profile = active?.profile
  if (!active || !profile || profile.kids) return null

  let lists: any[] = []
  try {
    const { default: clientPromise } = await import('@/src/lib/mongodb')
    lists = await (await clientPromise).db().collection('userContent')
      .find({ userId: active.userId, profileId: profile.id, type: { $in: ['history', 'favorites', 'saved'] } })
      .toArray()
  } catch (error) {
    console.error('Drama hubs: could not read the watch history:', error)
    return null
  }
  const listOf = (type: string): any[] => lists.find((list) => list.type === type)?.items ?? []
  const known = new Set<string>()
  for (const type of ['history', 'favorites', 'saved']) for (const item of listOf(type)) known.add(keyOf(item.media_type, item.id))

  // The history is newest first. Which of its series are the hub's? (Records cached a week.)
  const series = listOf('history').filter((item) => item.media_type === 'tv' && /^\d+$/.test(String(item.id))).slice(0, LOOK_BACK)
  const language = tmdbLanguage(locale)
  const details = await Promise.all(series.map((item) => tmdbFetchSafe<any>(`tv/${item.id}`, { language }, 7 * DAY)))
  const hubSeries = series
    .map((item, index) => ({ item, detail: details[index] }))
    .filter(({ detail }) => detail && belongsToHub({ ...detail, genre_ids: detail.genres?.map((genre: any) => genre.id) }, hub))

  const resume: ResumeItem[] = hubSeries
    .filter(({ item }) => Number.isInteger(item.season) && Number.isInteger(item.episode))
    .slice(0, RESUME_MAX)
    .map(({ item, detail }) => ({
      id: String(item.id),
      title: detail.name || item.title,
      backdrop: detail.backdrop_path ?? null,
      poster: detail.poster_path ?? item.poster_path ?? null,
      season: item.season,
      episode: item.episode,
      href: `/tv/${item.id}?s=${item.season}&e=${item.episode}`,
    }))

  let because: DramasForYou['because'] = null
  for (const { item, detail } of hubSeries.slice(0, 3)) {
    const data = await tmdbFetchSafe<{ results: any[] }>(`tv/${item.id}/recommendations`, { language }, DAY)
    const items: DramaItem[] = (data?.results ?? [])
      .filter((entry) => entry.poster_path && belongsToHub(entry, hub) && !known.has(keyOf('tv', entry.id)))
      .map((entry) => ({ ...entry, media_type: 'tv' as const }))
    if (items.length >= rowMinimum('for-you')) {
      because = { seed: { id: String(item.id), title: detail.name || item.title }, items: items.slice(0, 20) }
      break
    }
  }

  return { resume, because }
}
