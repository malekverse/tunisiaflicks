// GET /api/app/v1/search?q=&lang=&kids= → { results: AppCard[] }: movies and shows (people left out).
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { filterKidSafe } from '@/src/lib/kids'
import { HOUR, readQuery, toCards } from '@/src/lib/app-api/shared'
import { cached, failure, limited } from '@/src/lib/app-api/respond'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!q) return cached({ results: [] }, HOUR)
  if (q.length > 100) return failure('invalid_query', 400)
  const blocked = await limited(request, 'search', 300)
  if (blocked) return blocked
  const { locale, kids } = readQuery(url)
  const data = await tmdbFetchSafe<{ results?: any[] }>('search/multi', { query: q, include_adult: false, language: catalogueLanguage(locale) }, 24 * HOUR)
  if (!data) return failure('tmdb_unavailable', 502)
  const results = kids ? await filterKidSafe(data.results ?? []) : data.results ?? []
  return cached({ results: toCards(results) }, 24 * HOUR)
}
