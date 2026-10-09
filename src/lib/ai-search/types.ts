// The shapes Ask passes around. Client-safe (types only).
import type { GenreKey, RegionKey, SortKey } from './vocab'

export type Kind = 'movie' | 'tv'
export type PlanKind = Kind | 'any'

/**
 * What a request means, before any TMDB lookup: the model's answer (or the simple parser's), each
 * part carrying the words of the request it comes from (`span`, checked against the request).
 * Free text here (keyword terms, names, a title) is only ever used to look things up on TMDB; what
 * people see is TMDB's own name for what was found.
 */
export type RawPlan = {
  intent: 'discover' | 'title' | 'person' | 'unclear'
  /** For a request that only names a title or a person: the words that name it. */
  title: string | null
  kind: PlanKind
  genres: { id: GenreKey, span: string }[]
  without: { id: GenreKey, span: string }[]
  keywords: { term: string, span: string }[]
  places: { name: string, span: string }[]
  /** ISO 3166-1 codes, or region keys (arab, maghreb...). */
  countries: { code: string, span: string }[]
  languages: { code: string, span: string }[]
  people: { name: string, span: string }[]
  like: { title: string, year: number | null, span: string } | null
  years: { from: number | null, to: number | null, span: string } | null
  runtime: { min: number | null, max: number | null, span: string } | null
  minRating: { value: number, span: string } | null
  sort: SortKey
  /** Words that matter but fit nothing (they must appear in the request). */
  unmatched: string[]
}

/**
 * A resolved plan: TMDB ids and fixed keys only, nothing written by the model. It travels in the
 * URL (`p=`, see plan-codec.ts) and in the body of POST /api/ai/search, and is re-checked there.
 */
export type SearchPlan = {
  kind: PlanKind
  genres: GenreKey[]
  without: GenreKey[]
  keywords: number[]
  places: number[]
  countries: string[]
  regions: RegionKey[]
  languages: string[]
  people: number[]
  like: { type: Kind, id: number } | null
  years: { from: number | null, to: number | null } | null
  runtime: { min: number | null, max: number | null } | null
  minRating: number | null
  sort: SortKey
}

/** One interpretation chip: its id names the part of the plan it removes (see removeFacet). */
export type AskChip = { id: string, label: string }

export type AskNotice =
  | { code: 'resting' }
  | { code: 'unmatched', words: string[] }
  | { code: 'likeNotFound', title: string }

/** A title as the results grid needs it (a slim TMDB record). */
export type AskItem = {
  id: number
  media_type: Kind
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  genre_ids: number[]
  overview?: string
}

/** The lines of POST /api/ai/search's NDJSON answer. */
export type AskEvent =
  /** `src`: where the meaning came from (a plan sent back is 'plan'); for the logs and the tests. */
  | { t: 'plan', p: string, chips: AskChip[], ai: boolean, notices: AskNotice[], src: 'cache' | 'model' | 'parser' | 'plan' }
  | { t: 'results', items: AskItem[], page: number, hasMore: boolean, tryWithout: string | null }
  | { t: 'switch', q: string, reason: 'title' | 'resting' }
  | { t: 'error', code: 'tmdb' | 'failed' }

/** The JSON of a refused request (429 and the other statuses). */
export type AskRefusal = { code: string, retryAfter?: number, signIn?: boolean, error?: string }
