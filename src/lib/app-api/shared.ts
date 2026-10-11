// The native apps' API (/api/app/v1/…, used by mobile/): small JSON shapes for the screens the apps
// draw themselves. Public and cached at the edge, so the TMDB key stays on the server and a crowd of
// phones costs a handful of TMDB calls. Text comes in the asked language (?lang=en|fr|ar|tn); row
// titles and labels are the app's own strings.
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/src/lib/i18n/locales'

export type Kind = 'movie' | 'tv'

/** A title on a row or in a grid. Image fields are TMDB paths ('/abc.jpg'); the app picks sizes. */
export type AppCard = {
  id: number
  kind: Kind
  title: string
  poster: string | null
  backdrop: string | null
  year: string
  /** TMDB's average out of 10, one decimal; null without votes. */
  rating: number | null
}

export const HOUR = 3600

export type AppQuery = { locale: Locale, kids: boolean }

/** ?lang= (any of the site's languages, English otherwise) and ?kids=1 (kid-safe titles only). */
export function readQuery(url: URL): AppQuery {
  const lang = url.searchParams.get('lang')
  return { locale: isLocale(lang) ? lang : DEFAULT_LOCALE, kids: url.searchParams.get('kids') === '1' }
}

const yearOf = (date: unknown) => (typeof date === 'string' ? date.slice(0, 4) : '')

/** A TMDB movie or show (from a list, a search or recommendations) as an AppCard; null for people and oddities. */
export function toCard(item: any, kind?: Kind): AppCard | null {
  const k: Kind | null = kind ?? (item?.media_type === 'movie' || item?.media_type === 'tv' ? item.media_type : null)
  if (!k || !item || typeof item.id !== 'number') return null
  const title = (k === 'movie' ? item.title : item.name) || item.original_title || item.original_name
  if (!title) return null
  const votes = typeof item.vote_count === 'number' ? item.vote_count : 0
  return {
    id: item.id,
    kind: k,
    title,
    poster: item.poster_path ?? null,
    backdrop: item.backdrop_path ?? null,
    year: yearOf(k === 'movie' ? item.release_date : item.first_air_date),
    rating: votes > 0 && typeof item.vote_average === 'number' ? Math.round(item.vote_average * 10) / 10 : null,
  }
}

/** Cards from a TMDB list, without duplicates or titles that have no picture to show. */
export function toCards(items: unknown, kind?: Kind): AppCard[] {
  const seen = new Set<string>()
  const cards: AppCard[] = []
  for (const item of Array.isArray(items) ? items : []) {
    const card = toCard(item, kind)
    if (!card || (!card.poster && !card.backdrop)) continue
    const key = `${card.kind}:${card.id}`
    if (seen.has(key)) continue
    seen.add(key)
    cards.push(card)
  }
  return cards
}
