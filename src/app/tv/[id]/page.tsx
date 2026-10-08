import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TvDetail from '@/src/components/detail/TvDetail'
import { TmdbError, tmdbFetch, tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage, localizeDetail, logoLanguages, translatedRecord } from '@/src/lib/tmdb-locale'
import { getLocale } from '@/src/lib/i18n/server'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { filterKidSafe, isKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'

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
    return await tmdbFetch(`tv/${id}`, { append_to_response: 'images,credits,videos,external_ids', include_image_language: imageLanguages })
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
  const [show, recommendations, translated, kids] = await Promise.all([
    getShow(params.id, logoLanguages(locale)),
    tmdbFetchSafe(`tv/${params.id}/recommendations`, { language: catalogueLanguage(locale) }),
    translatedRecord('tv', params.id, locale),
    getKidsMode(),
  ])

  if (kids && !(await isKidSafe(show, 'tv'))) return <KidsBlocked />
  const similar = kids ? await filterKidSafe(recommendations?.results ?? [], 'tv') : recommendations?.results ?? []

  const data = localizeDetail(show, translated, locale)
  return <TvDetail id={params.id} data={data} similar={similar} resume={parseResume(searchParams)} />
}
