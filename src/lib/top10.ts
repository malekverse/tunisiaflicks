// The Top 10 row: what people on TunisiaFlicks watched most this week when there's enough
// activity to say so honestly, otherwise TMDB's weekly worldwide trending list (and labelled so).
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'

export type Top10 = { source: 'site' | 'world', items: any[] }

export async function getTop10(kids: boolean, community: any[]): Promise<Top10> {
  if (community.length >= 10) return { source: 'site', items: community.slice(0, 10) }
  const data = await tmdbFetchSafe<{ results: any[] }>('trending/all/week', {}, 3600)
  let items = (data?.results ?? []).filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
  if (kids) items = await filterKidSafe(items)
  return { source: 'world', items: items.slice(0, 10) }
}
