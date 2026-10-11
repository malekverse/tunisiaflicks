// GET /api/app/v1/list/{key}?page=&lang=&kids= → { key, kind, items, page, totalPages }.
// Keys: lib/app-api/lists (trending-movies, tunisian-tv, genre-movie-28…).
import { getList, isListKey } from '@/src/lib/app-api/lists'
import { HOUR, readQuery } from '@/src/lib/app-api/shared'
import { cached, failure, limited } from '@/src/lib/app-api/respond'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { key: string } }) {
  if (!isListKey(params.key)) return failure('not_found', 404)
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') ?? '1')
  if (!Number.isInteger(page) || page < 1 || page > 20) return failure('invalid_page', 400)
  const blocked = await limited(request, 'list')
  if (blocked) return blocked
  const { locale, kids } = readQuery(url)
  const list = await getList(params.key, page, locale, kids)
  return list ? cached(list, HOUR) : failure('tmdb_unavailable', 502)
}
