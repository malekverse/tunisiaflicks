// "More like this, but…" on TMDB: the title's facts and keywords, then up to three discover
// requests per variation (lib/variations.ts says which), merged and ranked. Server only (TMDB key).
// Kids profiles get the Kids discover filters and a rating check on every result, so their
// results are cached under their own keys (the discover URLs differ).
import 'server-only'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { filterKidSafe, kidsDiscoverParams } from '@/src/lib/kids'
import {
  discoverAttempts, isAvailable, rankResults, referenceGenres, topKeywords, variationFacts,
  type Kind, type Variation, type VariationFacts,
} from '@/src/lib/variations'

/** What a result row needs (PosterCard and the peek), nothing more. */
export type VariationItem = {
  id: number
  media_type: Kind
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  vote_count: number
  release_date?: string
  first_air_date?: string
  genre_ids: number[]
  overview?: string
}

const DAY = 86400
/** Enough results to stop asking: a full row. */
const ENOUGH = 12
const LIMIT = 20

/** The title's facts and its distinctive keywords (one cached TMDB call). */
export async function titleFacts(kind: Kind, id: string): Promise<{ facts: VariationFacts, keywords: number[] } | null> {
  const data = await tmdbFetchSafe<any>(`${kind}/${id}`, { append_to_response: 'keywords' }, DAY)
  if (!data?.id) return null
  const list = kind === 'movie' ? data.keywords?.keywords : data.keywords?.results
  return { facts: variationFacts(kind, data), keywords: topKeywords(Array.isArray(list) ? list : []) }
}

const slim = (item: any, kind: Kind): VariationItem => ({
  id: item.id,
  media_type: kind,
  ...(kind === 'movie' ? { title: item.title, release_date: item.release_date } : { name: item.name, first_air_date: item.first_air_date }),
  poster_path: item.poster_path ?? null,
  backdrop_path: item.backdrop_path ?? null,
  vote_average: item.vote_average ?? 0,
  vote_count: item.vote_count ?? 0,
  genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
  overview: typeof item.overview === 'string' ? item.overview.slice(0, 400) : undefined,
})

/**
 * A variation's titles for a title page: [] when the variation doesn't apply to it (or to a Kids
 * profile), or when TMDB has nothing; null when TMDB couldn't be reached at all.
 */
export async function fetchVariation(kind: Kind, id: string, variation: Variation, opts: { kids: boolean, language?: string }): Promise<VariationItem[] | null> {
  const title = await titleFacts(kind, id)
  if (!title) return null
  const { facts, keywords } = title
  if (!isAvailable(variation, facts, opts.kids)) return []

  const attempts = discoverAttempts(variation, facts, keywords)
  const found: VariationItem[] = []
  const seen = new Set<string>()
  let reached = false
  for (const attempt of attempts) {
    const params = opts.kids ? kidsDiscoverParams(attempt.kind, attempt.params) : attempt.params
    const data = await tmdbFetchSafe<{ results?: any[] }>(`discover/${attempt.kind}`, { ...params, page: 1, language: opts.language }, DAY)
    if (!data) continue
    reached = true
    let results = (data.results ?? []).filter((item) => item && item.poster_path)
    if (opts.kids) results = await filterKidSafe(results, attempt.kind, 20)
    for (const item of results) {
      const key = `${attempt.kind}:${item.id}`
      if (seen.has(key) || (attempt.kind === kind && String(item.id) === id)) continue
      seen.add(key)
      found.push(slim(item, attempt.kind))
    }
    if (found.length >= ENOUGH) break
  }
  if (!reached) return null
  const target: Kind = variation === 'kind' ? (kind === 'movie' ? 'tv' : 'movie') : kind
  return rankResults(found, referenceGenres(variation, facts), { kind, id }, target).slice(0, LIMIT)
}
