// A film page's franchise (lib/franchise has the rules): TMDB's collection, kept a day, Kids-safe
// for a Kids profile and without what Halal mode hides (tmdbFetch filters collections), and which
// of its films the profile has in its watch history.
import 'server-only'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetch } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { filterKidSafe } from '@/src/lib/kids'
import type { ActiveProfile } from '@/src/lib/profiles'
import type { Locale } from '@/src/lib/i18n/locales'
import { tunisDay } from '@/src/lib/guess'
import { orderParts, worthShowing, type Franchise } from '@/src/lib/franchise'

/** Which of `ids` the profile has watched. */
async function watchedOf(active: ActiveProfile | null, ids: string[]): Promise<string[]> {
  if (!active?.profile || ids.length === 0) return []
  const doc = await (await clientPromise).db().collection('userContent').findOne(
    { userId: active.userId, profileId: active.profile.id, type: 'history' },
    { projection: { items: { $filter: { input: '$items', as: 'item', cond: { $and: [{ $in: ['$$item.id', ids] }, { $ne: ['$$item.media_type', 'anime'] }] } } } } },
  )
  const items: { id?: unknown }[] = Array.isArray(doc?.items) ? doc.items : []
  return [...new Set(items.map((item) => String(item.id)))]
}

export async function franchiseFor(movie: any, locale: Locale, { kids, active }: { kids: boolean, active: ActiveProfile | null }): Promise<Franchise | null> {
  const collection = movie?.belongs_to_collection
  const id = Number(collection?.id)
  if (!Number.isInteger(id) || id <= 0) return null
  const data = await tmdbFetch(`collection/${id}`, { language: catalogueLanguage(locale) }, 86400)
  const raw = Array.isArray(data?.parts) ? data.parts : []
  let parts = orderParts(kids ? await filterKidSafe(raw, 'movie') : raw, tunisDay(new Date()))
  // The page's own film always belongs (a translation can leave it out of a filtered list).
  if (!parts.some((part) => part.id === String(movie.id))) parts = []
  if (!worthShowing(parts)) return null
  return {
    id,
    name: String(data?.name || collection?.name || '').trim(),
    parts,
    seen: await watchedOf(active, parts.map((part) => part.id)),
  }
}
