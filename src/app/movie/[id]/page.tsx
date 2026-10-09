import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MovieDetail from '@/src/components/detail/MovieDetail'
import { TmdbError, tmdbFetch, tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage, localizeDetail, logoLanguages, translatedRecord } from '@/src/lib/tmdb-locale'
import { getLocale } from '@/src/lib/i18n/server'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { filterKidSafe, isKidSafe } from '@/src/lib/kids'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'
import { getProviderTemplates } from '@/src/lib/stream-providers'
import { ratingSummary } from '@/src/lib/social/ratings'
import { readSoundtrack } from '@/src/lib/soundtrack'
import { videoExtras } from '@/src/lib/extras'
import { trailerLanguages } from '@/src/lib/media-assets'
import { similarTabs, variationFacts } from '@/src/lib/variations'
import { withTimeout } from '@/src/lib/with-timeout'

type Props = { params: { id: string } }

const isValidId = (id: string) => /^\d+$/.test(id)

async function getMovie(id: string, imageLanguages = 'en,null') {
  if (!isValidId(id)) notFound()
  try {
    // Videos in English, Arabic and French (and without a language): the trailer and the extras
    // pick the viewer's language first.
    return await tmdbFetch(`movie/${id}`, { append_to_response: 'images,credits,videos,external_ids', include_image_language: imageLanguages, include_video_language: 'en,ar,fr,null' })
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
  const [movie, recommendations, translated, kids, active] = await Promise.all([
    getMovie(params.id, logoLanguages(locale)),
    tmdbFetchSafe(`movie/${params.id}/recommendations`, { language: catalogueLanguage(locale) }),
    translatedRecord('movie', params.id, locale),
    getKidsMode(),
    getActiveProfile(),
  ])

  if (kids && !(await isKidSafe(movie, 'movie'))) return <KidsBlocked />
  const id = String(movie.id ?? params.id)
  const signedIn = !!active
  const [similar, summary, soundtrack] = await Promise.all([
    kids ? filterKidSafe(recommendations?.results ?? [], 'movie') : recommendations?.results ?? [],
    // Guests only see the ratings band when there is an average to show.
    signedIn ? null : withTimeout(ratingSummary('movie', id), 1500, { average: null, countLabel: null }),
    withTimeout(readSoundtrack('movie', id), 1200, { state: 'unknown' as const }),
  ])

  const data = localizeDetail(movie, translated, locale)
  const { trailers, groups } = videoExtras(movie.videos?.results, trailerLanguages(locale))
  return (
    <MovieDetail
      id={id}
      data={data}
      similar={similar}
      providers={getProviderTemplates()}
      kids={kids}
      signedIn={signedIn}
      ratings={signedIn || (summary?.average !== null && summary?.average !== undefined)}
      tabs={similarTabs(similar.length, variationFacts('movie', movie), kids, locale)}
      trailers={trailers.map((video) => ({ key: video.key, title: video.title || data.title }))}
      extras={groups}
      // Kids profiles get no links out.
      soundtrack={soundtrack.state === 'found' && kids ? { state: 'found', album: { ...soundtrack.album, link: null } } : soundtrack}
    />
  )
}
