// Titles as other people see them. Anything shown to someone else (a sent title, a rating, a
// friend's watch) is read back from TMDB here, never taken from text a client sent.
import 'server-only'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import type { Locale } from '@/src/lib/i18n/locales'
import type { ShareMedia } from './types'

const isMediaType = (value: unknown): value is 'movie' | 'tv' => value === 'movie' || value === 'tv'
export const isTmdbId = (value: unknown): value is string => typeof value === 'string' && /^[0-9]{1,9}$/.test(value)

/** The TMDB record behind a share (cached for a day), or null when the id or type is wrong or unknown. */
export async function tmdbRecord(media_type: unknown, id: unknown, locale?: Locale): Promise<Record<string, any> | null> {
  const value = typeof id === 'number' ? String(id) : id
  if (!isMediaType(media_type) || !isTmdbId(value)) return null
  const language = locale ? tmdbLanguage(locale) : 'en-US'
  const data = await tmdbFetchSafe<Record<string, any>>(`${media_type}/${value}`, { language }, 86400)
  return data && (data.id !== undefined) ? data : null
}

export async function resolveShareMedia(media_type: 'movie' | 'tv', id: string, locale?: Locale): Promise<ShareMedia | null> {
  const data = await tmdbRecord(media_type, id, locale)
  if (!data) return null
  const title = String(data.title || data.name || data.original_title || data.original_name || '').trim()
  if (!title) return null
  const poster = typeof data.poster_path === 'string' && /^\/[A-Za-z0-9._-]+$/.test(data.poster_path) ? data.poster_path : null
  return { media_type, id: String(Number(id)), title, poster_path: poster }
}

export const mediaHref = (media_type: 'movie' | 'tv', id: string) => `/${media_type}/${id}`
