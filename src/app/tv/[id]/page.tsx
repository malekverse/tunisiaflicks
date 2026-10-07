import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TvDetail from '@/src/components/detail/TvDetail'
import { TmdbError, tmdbFetch, tmdbFetchSafe } from '@/src/lib/tmdb'

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
  const [show, recommendations] = await Promise.all([
    getShow(params.id),
    tmdbFetchSafe(`tv/${params.id}/recommendations`),
  ])

  return <TvDetail id={params.id} data={show} similar={recommendations?.results ?? []} resume={parseResume(searchParams)} />
}
