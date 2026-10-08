import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MovieDetail from '@/src/components/detail/MovieDetail'
import { TmdbError, tmdbFetch, tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage, localizeDetail, logoLanguages, translatedRecord } from '@/src/lib/tmdb-locale'
import { getLocale } from '@/src/lib/i18n/server'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { filterKidSafe, isKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'

type Props = { params: { id: string } }

const isValidId = (id: string) => /^\d+$/.test(id)

async function getMovie(id: string, imageLanguages = 'en,null') {
  if (!isValidId(id)) notFound()
  try {
    return await tmdbFetch(`movie/${id}`, { append_to_response: 'images,credits,videos,external_ids', include_image_language: imageLanguages })
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidId(params.id)) return {}
  const locale = getLocale()
  const [english, translated] = await Promise.all([tmdbFetchSafe(`movie/${params.id}`), translatedRecord('movie', params.id, locale)])
  if (!english) return {}
  const movie = localizeDetail(english, translated, locale)
  const year = movie.release_date?.substring(0, 4)
  // The share image comes from ./opengraph-image.tsx (card: false).
  return pageMetadata({
    title: `${movie.title}${year ? ` (${year})` : ''}`,
    description: movie.overview,
    path: `/movie/${params.id}`,
    card: false,
    openGraph: { type: 'video.movie', releaseDate: movie.release_date || undefined, duration: movie.runtime ? movie.runtime * 60 : undefined },
  })
}

export default async function MoviePage({ params }: Props) {
  // In the viewer's language where TMDB has it (lib/tmdb-locale): Arabic overview and genres
  // (titles stay as they are); in French also the title, tagline, poster and a French logo.
  const locale = getLocale()
  const [movie, recommendations, translated, kids] = await Promise.all([
    getMovie(params.id, logoLanguages(locale)),
    tmdbFetchSafe(`movie/${params.id}/recommendations`, { language: catalogueLanguage(locale) }),
    translatedRecord('movie', params.id, locale),
    getKidsMode(),
  ])

  if (kids && !(await isKidSafe(movie, 'movie'))) return <KidsBlocked />
  const similar = kids ? await filterKidSafe(recommendations?.results ?? [], 'movie') : recommendations?.results ?? []

  const data = localizeDetail(movie, translated, locale)
  return <MovieDetail id={params.id} data={data} similar={similar} />
}
