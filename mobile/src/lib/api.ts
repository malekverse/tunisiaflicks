// The site's API for the apps (/api/app/v1, see src/lib/app-api on the site), with React Query:
// answers are cached in memory, refetched when stale, and retried on a flaky connection.
import Constants from 'expo-constants'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useStore } from './store'

export type Kind = 'movie' | 'tv'

export type Card = { id: number, kind: Kind, title: string, poster: string | null, backdrop: string | null, year: string, rating: number | null }

export type BillboardItem = {
  id: number
  kind: Kind
  title: string
  overview: string
  backdrop: string
  poster: string | null
  logo: { path: string, ratio: number } | null
  trailer: string | null
  year: string
  rating: number
  genres: string[]
  runtime: number | null
  seasons: number | null
}

export type Row = { key: string, style: 'poster' | 'top10' | 'landscape', items: Card[], source?: 'site' | 'world', more: boolean }
export type Home = { billboard: BillboardItem[], rows: Row[] }

export type Source = { name: string, movie: string, tv: string, sandbox?: boolean }

export type Title = {
  id: number
  kind: Kind
  title: string
  originalTitle: string
  tagline: string
  overview: string
  year: string
  runtime: number | null
  rating: number | null
  genres: { id: number, name: string }[]
  backdrop: string | null
  poster: string | null
  logo: { path: string, ratio: number } | null
  trailer: string | null
  imdbId: string | null
  cast: { id: number, name: string, character: string, profile: string | null }[]
  seasons: { number: number, name: string, episodes: number, poster: string | null, year: string }[]
  similar: Card[]
  sources: Source[]
}

export type Episode = { number: number, name: string, overview: string, still: string | null, runtime: number | null, airDate: string, rating: number | null }
export type Season = { number: number, name: string, overview: string, episodes: Episode[] }
export type ListPage = { key: string, kind: Kind, items: Card[], page: number, totalPages: number }
export type Genres = { movie: { id: number, name: string }[], tv: { id: number, name: string }[] }
export type Version = { version: string | null, android: { url: string, size: number } | null, tv: { url: string, size: number } | null }
export type Health = Record<string, { ok: number, broken: number, status: 'good' | 'down' | 'unknown' }>

export const SITE: string = (Constants.expoConfig?.extra?.api as string | undefined) ?? 'https://tunisiaflicks.vercel.app'

/** An API error the screens can tell apart (not found, Kids mode, offline...). */
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${SITE}/api/app/v1${path}`)
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value))
  let response: Response
  try {
    response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  } catch {
    throw new ApiError(0, 'offline')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { code?: string } | null
    throw new ApiError(response.status, body?.code ?? 'error')
  }
  return response.json() as Promise<T>
}

/** The query every request carries: the language and Kids mode. */
function useBase() {
  const locale = useStore((state) => state.locale)
  const kids = useStore((state) => state.kids)
  return { lang: locale, kids: kids ? 1 : undefined, key: [locale, kids] as const }
}

const retry = (count: number, error: unknown) => {
  // A missing title or Kids mode won't change by retrying.
  if (error instanceof ApiError && (error.status === 404 || error.status === 403 || error.status === 400)) return false
  return count < 2
}

export function useHome() {
  const { lang, kids, key } = useBase()
  return useQuery({ queryKey: ['home', ...key], queryFn: () => get<Home>('/home', { lang, kids }), staleTime: 15 * 60_000, retry })
}

export function useTitle(kind: Kind, id: number) {
  const { lang, kids, key } = useBase()
  return useQuery({ queryKey: ['title', kind, id, ...key], queryFn: () => get<Title>(`/title/${kind}/${id}`, { lang, kids }), staleTime: 60 * 60_000, retry })
}

export function useSeason(id: number, season: number | null) {
  const { lang, key } = useBase()
  return useQuery({
    queryKey: ['season', id, season, key[0]],
    queryFn: () => get<Season>(`/title/tv/${id}/season/${season}`, { lang }),
    enabled: season !== null,
    staleTime: 60 * 60_000,
    retry,
  })
}

export function useSearch(q: string) {
  const { lang, kids, key } = useBase()
  const query = q.trim()
  return useQuery({
    queryKey: ['search', query, ...key],
    queryFn: () => get<{ results: Card[] }>('/search', { q: query, lang, kids }),
    enabled: query.length >= 2,
    staleTime: 60 * 60_000,
    placeholderData: (previous) => previous,
    retry,
  })
}

export function useList(listKey: string) {
  const { lang, kids, key } = useBase()
  return useInfiniteQuery({
    queryKey: ['list', listKey, ...key],
    queryFn: ({ pageParam }) => get<ListPage>(`/list/${listKey}`, { page: pageParam, lang, kids }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 30 * 60_000,
    retry,
  })
}

export function useGenres() {
  const { lang, kids, key } = useBase()
  return useQuery({ queryKey: ['genres', ...key], queryFn: () => get<Genres>('/genres', { lang, kids }), staleTime: 24 * 60 * 60_000, retry })
}

export function useVersion() {
  return useQuery({ queryKey: ['version'], queryFn: () => get<Version>('/version'), staleTime: 60 * 60_000, retry })
}

/** The crowd's view of each source (the site's player shares it): the broken ones go last. */
export function useSourceHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch(`${SITE}/api/stream-health`)
      return (response.ok ? response.json() : {}) as Promise<Health>
    },
    staleTime: 5 * 60_000,
  })
}

/** Tells the site a source played or didn't (one vote per source per hour; failures are ignored). */
export function reportSource(name: string, ok: boolean) {
  fetch(`${SITE}/api/stream-health`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, ok }) }).catch(() => {})
}

/** The sources best first: the one that played last time, then the site's order with the broken ones last. */
export function orderSources(sources: Source[], health: Health | undefined, preferred?: string): Source[] {
  const rank = (source: Source) => (source.name === preferred ? -1 : health?.[source.name]?.status === 'down' ? 1 : 0)
  return sources.map((source, index) => ({ source, index })).sort((a, b) => rank(a.source) - rank(b.source) || a.index - b.index).map(({ source }) => source)
}

/** A source's address for a movie, or for an episode of a show. */
export function sourceUrl(source: Source, kind: Kind, id: number, season = 1, episode = 1): string {
  const template = kind === 'movie' ? source.movie : source.tv
  return template.replace('{id}', String(id)).replace('{season}', String(season)).replace('{episode}', String(episode))
}
