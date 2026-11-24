// A film's franchise in the order to watch it (TMDB's "collection": Harry Potter, The Lord of the
// Rings…), with how far the viewer has got. lib/franchise-server fetches it; components/detail/
// FranchiseOrder shows it. Pure, so it's unit-tested.

/** One film of the franchise, as the page needs it. */
export type FranchisePart = {
  id: string
  title: string
  poster: string | null
  backdrop: string | null
  /** YYYY-MM-DD, or null when TMDB has no date yet. */
  date: string | null
  vote: number
  overview?: string
  genreIds?: number[]
  /** Not out yet (a date after today, or none). */
  upcoming: boolean
}

export type Franchise = {
  id: number
  name: string
  parts: FranchisePart[]
  /** The ids of the parts this profile has watched (none for a guest). */
  seen: string[]
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * TMDB's parts in the order they came out, the ones not out yet at the end (those with a date
 * first, by date). Anything without an id or a title is left out.
 */
export function orderParts(parts: unknown, today: string): FranchisePart[] {
  if (!Array.isArray(parts)) return []
  const list: FranchisePart[] = []
  for (const raw of parts) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, any>
    const id = typeof item.id === 'number' || typeof item.id === 'string' ? String(item.id) : ''
    const title = String(item.title || item.original_title || '').trim()
    if (!/^\d+$/.test(id) || !title) continue
    const date = typeof item.release_date === 'string' && DAY.test(item.release_date) ? item.release_date : null
    list.push({
      id,
      title,
      poster: typeof item.poster_path === 'string' ? item.poster_path : null,
      backdrop: typeof item.backdrop_path === 'string' ? item.backdrop_path : null,
      date,
      vote: typeof item.vote_average === 'number' ? item.vote_average : 0,
      overview: typeof item.overview === 'string' ? item.overview : undefined,
      genreIds: Array.isArray(item.genre_ids) ? item.genre_ids.filter((genre: unknown) => typeof genre === 'number') : undefined,
      upcoming: !date || date > today,
    })
  }
  const rank = (part: FranchisePart) => (part.upcoming ? (part.date ? 1 : 2) : 0)
  return list.sort((a, b) => rank(a) - rank(b) || (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title))
}

/** Worth a section: at least two films out (a "collection" of one film and an announcement isn't). */
export const worthShowing = (parts: FranchisePart[]) => parts.filter((part) => !part.upcoming).length >= 2

export type FranchiseProgress = {
  /** Films out, and how many of them were watched. */
  total: number
  watched: number
  /** The first film out not watched yet, in order (null: all watched). */
  next: FranchisePart | null
}

export function franchiseProgress(parts: FranchisePart[], seen: Iterable<string>): FranchiseProgress {
  const seenIds = new Set(seen)
  const out = parts.filter((part) => !part.upcoming)
  return {
    total: out.length,
    watched: out.filter((part) => seenIds.has(part.id)).length,
    next: out.find((part) => !seenIds.has(part.id)) ?? null,
  }
}
