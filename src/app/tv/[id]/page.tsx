import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TvDetail from '@/src/components/detail/TvDetail'
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

type Props = { params: { id: string }, searchParams?: { s?: string, e?: string } }

const isValidId = (id: string) => /^\d+$/.test(id)

// `?s=2&e=5` reopens that episode (used by "Continue Watching"). Ignored unless both are valid.
function parseResume(searchParams: Props['searchParams']) {
  const season = Number(searchParams?.s)
  const episode = Number(searchParams?.e)
  return Number.isInteger(season) && season >= 0 && Number.isInteger(episode) && episode >= 1
    ? { season, episode }
    : undefined
}

async function getShow(id: string, imageLanguages = 'en,null') {
  if (!isValidId(id)) notFound()
  try {
    // Videos in English, Arabic and French (and without a language): the trailer and the extras
    // pick the viewer's language first.
    return await tmdbFetch(`tv/${id}`, { append_to_response: 'images,credits,videos,external_ids', include_image_language: imageLanguages, include_video_language: 'en,ar,fr,null' })
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidId(params.id)) return {}
  const locale = getLocale()
  const [english, translated] = await Promise.all([tmdbFetchSafe(`tv/${params.id}`), translatedRecord('tv', params.id, locale)])
  if (!english) return {}
  const show = localizeDetail(english, translated, locale)
  const year = show.first_air_date?.substring(0, 4)
  // The share image comes from ./opengraph-image.tsx (card: false).
  return pageMetadata({
    title: `${show.name}${year ? ` (${year})` : ''}`,
    description: show.overview,
    path: `/tv/${params.id}`,
    card: false,
    openGraph: { type: 'video.tv_show' },
  })
}

export default async function TvPage({ params, searchParams }: Props) {
  // In the viewer's language where TMDB has it (lib/tmdb-locale): Arabic overview, genre and season
  // names (titles stay as they are); in French also the title, tagline, poster and a French logo.
  const locale = getLocale()
  const [show, recommendations, translated, kids, active] = await Promise.all([
    getShow(params.id, logoLanguages(locale)),
    tmdbFetchSafe(`tv/${params.id}/recommendations`, { language: catalogueLanguage(locale) }),
    translatedRecord('tv', params.id, locale),
    getKidsMode(),
    getActiveProfile(),
  ])

  if (kids && !(await isKidSafe(show, 'tv'))) return <KidsBlocked />
  const id = String(show.id ?? params.id)
  const signedIn = !!active
  const [similar, summary, soundtrack] = await Promise.all([
    kids ? filterKidSafe(recommendations?.results ?? [], 'tv') : recommendations?.results ?? [],
    // Guests only see the ratings band when there is an average to show.
    signedIn ? null : withTimeout(ratingSummary('tv', id), 1500, { average: null, countLabel: null }),
    withTimeout(readSoundtrack('tv', id), 1200, { state: 'unknown' as const }),
  ])

  const data = localizeDetail(show, translated, locale)
  const { trailers, groups } = videoExtras(show.videos?.results, trailerLanguages(locale))
  return (
    <TvDetail
      id={id}
      data={data}
      englishName={show.name}
      similar={similar}
      resume={parseResume(searchParams)}
      providers={getProviderTemplates()}
      kids={kids}
      signedIn={signedIn}
      ratings={signedIn || (summary?.average !== null && summary?.average !== undefined)}
      tabs={similarTabs(similar.length, variationFacts('tv', show), kids, locale)}
      trailers={trailers.map((video) => ({ key: video.key, title: video.title || data.name }))}
      extras={groups}
      // Kids profiles get no links out.
      soundtrack={soundtrack.state === 'found' && kids ? { state: 'found', album: { ...soundtrack.album, link: null } } : soundtrack}
    />
  )
}
