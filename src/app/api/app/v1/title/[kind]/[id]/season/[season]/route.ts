// GET /api/app/v1/title/tv/{id}/season/{n}?lang= → { number, name, overview, episodes }.
import { getSeason } from '@/src/lib/app-api/title'
import { HOUR, readQuery } from '@/src/lib/app-api/shared'
import { cached, failure, limited } from '@/src/lib/app-api/respond'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { kind: string, id: string, season: string } }) {
  if (params.kind !== 'tv' || !/^\d{1,3}$/.test(params.season)) return failure('not_found', 404)
  const blocked = await limited(request, 'season')
  if (blocked) return blocked
  const { locale } = readQuery(new URL(request.url))
  const season = await getSeason(params.id, Number(params.season), locale)
  return season ? cached(season, 6 * HOUR) : failure('not_found', 404)
}
