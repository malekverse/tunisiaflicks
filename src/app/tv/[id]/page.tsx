import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TvDetail from '@/src/components/detail/TvDetail'
import { TmdbError, tmdbFetch, tmdbFetchSafe, withTranslatedFields } from '@/src/lib/tmdb'
import { getLocale } from '@/src/lib/i18n/server'

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

async function getShow(id: string) {
  if (!isValidId(id)) notFound()
  try {
    return await tmdbFetch(`tv/${id}`, { append_to_response: 'images,credits,videos,external_ids', include_image_language: 'en,null' })
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidId(params.id)) return {}
  const show = await tmdbFetchSafe(`tv/${params.id}`)
  if (!show) return {}
  const year = show.first_air_date?.substring(0, 4)
  const title = `${show.name}${year ? ` (${year})` : ''} | TunisiaFlicks`
  return {
    title,
    description: show.overview || undefined,
    openGraph: {
      title,
      description: show.overview || undefined,
      images: show.backdrop_path ? [`https://image.tmdb.org/t/p/w780${show.backdrop_path}`] : undefined,
    },
  }
}

export default async function TvPage({ params, searchParams }: Props) {
  // Arabic UI: TMDB's Arabic overview, genre and season names where they exist; titles stay as they are.
  const arabic = getLocale() === 'ar'
  const [show, recommendations, translated] = await Promise.all([
    getShow(params.id),
    tmdbFetchSafe(`tv/${params.id}/recommendations`),
    arabic && isValidId(params.id) ? tmdbFetchSafe(`tv/${params.id}`, { language: 'ar' }) : null,
  ])

  const data = withTranslatedFields(show, translated, ['overview', 'genres'])
  if (translated?.seasons) {
    // Only the names (e.g. "الموسم 1"): posters stay the English ones.
    const names = new Map<number, string>(translated.seasons.map((season: any) => [season.id, season.name]))
    data.seasons = (data.seasons ?? []).map((season: any) => ({ ...season, name: names.get(season.id) || season.name }))
  }
  return <TvDetail id={params.id} data={data} similar={recommendations?.results ?? []} resume={parseResume(searchParams)} />
}
