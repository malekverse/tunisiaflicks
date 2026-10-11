// GET /api/app/v1/title/{movie|tv}/{id}?lang=&kids= → the title (see lib/app-api/title).
// 404 { code: 'not_found' }, 403 { code: 'kids_blocked' } on a Kids profile, 502 when TMDB is down.
import { getTitle } from '@/src/lib/app-api/title'
import { HOUR, readQuery } from '@/src/lib/app-api/shared'
import { cached, failure, limited } from '@/src/lib/app-api/respond'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { kind: string, id: string } }) {
  if (params.kind !== 'movie' && params.kind !== 'tv') return failure('not_found', 404)
  const blocked = await limited(request, 'title')
  if (blocked) return blocked
  const { locale, kids } = readQuery(new URL(request.url))
  const result = await getTitle(params.kind, params.id, locale, kids)
  if (result.status === 'ok') return cached(result.title, 6 * HOUR)
  if (result.status === 'not_found') return failure('not_found', 404)
  if (result.status === 'kids_blocked') return failure('kids_blocked', 403)
  return failure('tmdb_unavailable', 502)
}
