// "Trending on TunisiaFlicks": what people here actually watched this week, from everyone's watch
// history. Only anonymous counts leave the database, and a title needs several different viewers
// before it can appear, so the row never reveals what one person watched.
import { unstable_cache } from 'next/cache'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import type { Locale } from '@/src/lib/i18n'

const WINDOW_DAYS = 7
/** Different accounts that must have watched a title for it to count. */
export const MIN_VIEWERS = 2
/** Fewer titles than this and the row stays hidden (not much of a trend). */
const MIN_TITLES = 4

export type CommunityCount = { id: string, media_type: 'movie' | 'tv', viewers: number }

async function countViewers(): Promise<CommunityCount[]> {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000)
    const db = (await clientPromise).db()
    const rows = await db.collection('userContent').aggregate([
      { $match: { type: 'history', 'items.watched_at': { $gte: since } } },
      { $unwind: '$items' },
      { $match: { 'items.watched_at': { $gte: since }, 'items.media_type': { $in: ['movie', 'tv'] } } },
      {
        $group: {
          _id: { id: { $toString: '$items.id' }, media_type: '$items.media_type' },
          // Profiles of one account count once.
          viewers: { $addToSet: '$userId' },
          last: { $max: '$items.watched_at' },
        },
      },
      { $project: { viewers: { $size: '$viewers' }, last: 1 } },
      { $match: { viewers: { $gte: MIN_VIEWERS } } },
      { $sort: { viewers: -1, last: -1 } },
      { $limit: 30 },
    ]).toArray()
    return rows.map((row) => ({ id: row._id.id, media_type: row._id.media_type, viewers: row.viewers }))
  } catch (error) {
    console.error('Community trending failed:', error)
    return []
  }
}

// Shared by every visitor; refreshed every half hour.
const cachedCounts = unstable_cache(countViewers, ['community-trending'], { revalidate: 1800 })

/** This week's most watched titles on the site, as TMDB-like list items (most viewers first). */
export async function getCommunityTrending(kids: boolean, locale: Locale): Promise<any[]> {
  const counts = await cachedCounts()
  if (counts.length < MIN_TITLES) return []

  const language = tmdbLanguage(locale)
  const details = await Promise.all(counts.map((entry) =>
    tmdbFetchSafe(`${entry.media_type}/${entry.id}`, { language }, 86400)))
  const items = details.flatMap((data, index) => {
    if (!data?.id || !data.poster_path) return []
    return [{
      ...data,
      media_type: counts[index].media_type,
      genre_ids: (data.genres ?? []).map((genre: any) => genre.id),
      viewers: counts[index].viewers,
    }]
  })
  const visible = kids ? await filterKidSafe(items) : items
  return visible.length >= MIN_TITLES ? visible.slice(0, 20) : []
}
