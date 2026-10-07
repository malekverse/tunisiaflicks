import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MovieDetail from '@/src/components/detail/MovieDetail'
import { TmdbError, tmdbFetch, tmdbFetchSafe, withTranslatedFields } from '@/src/lib/tmdb'
import { getLocale } from '@/src/lib/i18n/server'
import { isArabicScript } from '@/src/lib/i18n'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { filterKidSafe, isKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'

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
    // The share image comes from ./opengraph-image.tsx (branded card); setting `images` here would override it.
    openGraph: {
      title,
      description: movie.overview || undefined,
    },
  }
}

export default async function MoviePage({ params }: Props) {
  // Arabic UI: TMDB's Arabic overview and genre names where they exist; titles stay as they are.
  const arabic = isArabicScript(getLocale())
  const [movie, recommendations, translated, kids] = await Promise.all([
    getMovie(params.id),
    tmdbFetchSafe(`movie/${params.id}/recommendations`),
    arabic && isValidId(params.id) ? tmdbFetchSafe(`movie/${params.id}`, { language: 'ar' }) : null,
    getKidsMode(),
  ])

  if (kids && !(await isKidSafe(movie, 'movie'))) return <KidsBlocked />
  const similar = kids ? await filterKidSafe(recommendations?.results ?? [], 'movie') : recommendations?.results ?? []

  const data = withTranslatedFields(movie, translated, ['overview', 'genres'])
  return <MovieDetail id={params.id} data={data} similar={similar} />
}
