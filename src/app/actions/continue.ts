'use server'

import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { getLocale } from '@/src/lib/i18n/server'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'

/** Backdrops for the "Continue watching" tiles (the history only keeps posters). Cached 3 days. */
export async function getResumeArt(items: { id: string, media_type: 'movie' | 'tv' }[]): Promise<Record<string, string | null>> {
  const list = items
    .filter((item) => /^\d+$/.test(String(item.id)) && (item.media_type === 'movie' || item.media_type === 'tv'))
    .slice(0, 15)
  const language = catalogueLanguage(getLocale())
  const art = await Promise.all(list.map(async (item) => {
    const data = await tmdbFetchSafe(`${item.media_type}/${item.id}`, { language }, 3 * 86400)
    return [`${item.media_type}:${item.id}`, data?.backdrop_path ?? null] as const
  }))
  return Object.fromEntries(art)
}
