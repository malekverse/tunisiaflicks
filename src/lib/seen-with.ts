// "Where have I seen them?": the titles in a profile's own watch history that a person (an actor,
// a director...) worked on. Only ever shown to that profile. Server only.
import 'server-only'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

export type SeenTitle = { media_type: 'movie' | 'tv', id: string, title: string, poster_path: string | null, year: string | null }
export type Watched = Map<string, { title: string, poster_path: string | null, at: number }>

const WEEK = 604800
export const MAX_PEOPLE = 30

export const titleKey = (media_type: string, id: string | number) => `${media_type}:${id}`

/** The profile's watch history, keyed 'movie:603', with when each was last watched. */
export async function watchedTitles(userId: string, profileId: string): Promise<Watched> {
  // Imported here so the matching below stays importable without a database (unit tests).
  const { default: clientPromise } = await import('@/src/lib/mongodb')
  const doc = await (await clientPromise).db().collection('userContent').findOne(
    { userId, profileId, type: 'history' },
    { projection: { items: 1 } },
  )
  return historyMap(doc?.items)
}

/** History items as a map (the newest entry of each title wins). */
export function historyMap(items: unknown): Watched {
  const map: Watched = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || (item.media_type !== 'movie' && item.media_type !== 'tv')) continue
    const id = String(item.id ?? '')
    if (!/^[0-9]{1,9}$/.test(id)) continue
    const at = new Date(item.watched_at ?? item.added_at ?? 0).getTime() || 0
    const key = titleKey(item.media_type, id)
    const previous = map.get(key)
    if (!previous || previous.at < at) {
      map.set(key, { title: typeof item.title === 'string' ? item.title : '', poster_path: typeof item.poster_path === 'string' ? item.poster_path : null, at })
    }
  }
  return map
}

/** A person's films and shows (cast and crew), cached for a week. Null when TMDB can't say. */
export async function personCredits(personId: number): Promise<any[] | null> {
  const data = await tmdbFetchSafe<{ cast?: any[], crew?: any[] }>(`person/${personId}/combined_credits`, {}, WEEK)
  if (!data) return null
  return [...(data.cast ?? []), ...(data.crew ?? [])]
}

/**
 * The credits that are in the history, once each, most recently watched first. `exclude`: the
 * title being looked at ('movie:603'), which obviously has them in it.
 */
export function seenInCredits(credits: any[], watched: Watched, exclude?: string | null): SeenTitle[] {
  const found = new Map<string, SeenTitle & { at: number }>()
  for (const credit of credits) {
    if (credit?.media_type !== 'movie' && credit?.media_type !== 'tv') continue
    const key = titleKey(credit.media_type, credit.id)
    if (key === exclude || found.has(key)) continue
    const seen = watched.get(key)
    if (!seen) continue
    const date: string = credit.release_date || credit.first_air_date || ''
    found.set(key, {
      media_type: credit.media_type,
      id: String(credit.id),
      title: credit.title || credit.name || seen.title,
      poster_path: credit.poster_path ?? seen.poster_path ?? null,
      year: date ? date.slice(0, 4) : null,
      at: seen.at,
    })
  }
  return Array.from(found.values()).sort((a, b) => b.at - a.at).map(({ at: _at, ...title }) => title)
}

/** For each person, the titles of theirs the profile has watched (people with none left out). */
export async function seenWith(people: number[], watched: Watched, exclude: string | null): Promise<Record<string, SeenTitle[]>> {
  const result: Record<string, SeenTitle[]> = {}
  if (!watched.size) return result
  const credits = await Promise.all(people.slice(0, MAX_PEOPLE).map((person) => personCredits(person)))
  people.slice(0, MAX_PEOPLE).forEach((person, index) => {
    const titles = seenInCredits(credits[index] ?? [], watched, exclude)
    if (titles.length) result[String(person)] = titles.slice(0, 12)
  })
  return result
}

/** `?people=1,2,3`: up to 30 distinct TMDB person ids, or null when malformed. */
export function parsePeople(value: string | null): number[] | null {
  if (!value) return null
  const ids = value.split(',').map((part) => part.trim())
  if (!ids.length || ids.some((id) => !/^[0-9]{1,9}$/.test(id))) return null
  const unique = Array.from(new Set(ids.map(Number)))
  return unique.length && unique.length <= MAX_PEOPLE ? unique : null
}

/** `?exclude=movie:603`, or null. */
export function parseExclude(value: string | null): string | null {
  return value && /^(movie|tv):[0-9]{1,9}$/.test(value) ? value : null
}
