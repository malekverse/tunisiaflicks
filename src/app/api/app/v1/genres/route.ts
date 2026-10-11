// GET /api/app/v1/genres?lang=&kids= → { movie: [{ id, name }], tv: [...] }, the grown-up genres
// left out on a Kids profile.
import { genreList } from '@/src/lib/tmdb-locale'
import { isGrownUpGenre } from '@/src/lib/kids'
import { HOUR, readQuery } from '@/src/lib/app-api/shared'
import { cached, limited } from '@/src/lib/app-api/respond'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const blocked = await limited(request, 'genres')
  if (blocked) return blocked
  const { locale, kids } = readQuery(new URL(request.url))
  const [movie, tv] = await Promise.all([genreList('movie', locale), genreList('tv', locale)])
  const keep = (genres: { id: number, name: string }[]) => (kids ? genres.filter((genre) => !isGrownUpGenre(genre.id)) : genres)
  return cached({ movie: keep(movie), tv: keep(tv) }, 24 * HOUR)
}
