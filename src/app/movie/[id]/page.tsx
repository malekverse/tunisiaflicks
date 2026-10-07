import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MovieDetail from '@/src/components/detail/MovieDetail'
import { TmdbError, tmdbFetch, tmdbFetchSafe } from '@/src/lib/tmdb'

type Props = { params: { id: string } }

const isValidId = (id: string) => /^\d+$/.test(id)

async function getMovie(id: string) {
  if (!isValidId(id)) notFound()
  try {
    return await tmdbFetch(`movie/${id}`, { append_to_response: 'images,credits,videos,external_ids', include_image_language: 'en,null' })
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidId(params.id)) return {}
  const movie = await tmdbFetchSafe(`movie/${params.id}`)
  if (!movie) return {}
  const year = movie.release_date?.substring(0, 4)
  const title = `${movie.title}${year ? ` (${year})` : ''} | TunisiaFlicks`
  return {
    title,
    description: movie.overview || undefined,
    openGraph: {
      title,
      description: movie.overview || undefined,
      images: movie.backdrop_path ? [`https://image.tmdb.org/t/p/w780${movie.backdrop_path}`] : undefined,
    },
  }
}

export default async function MoviePage({ params }: Props) {
  const [movie, recommendations] = await Promise.all([
    getMovie(params.id),
    tmdbFetchSafe(`movie/${params.id}/recommendations`),
  ])

  return <MovieDetail id={params.id} data={movie} similar={recommendations?.results ?? []} />
}
