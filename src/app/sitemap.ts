import type { MetadataRoute } from 'next'
import { SITE_HOST } from '@/src/lib/seo'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { getTunisianTitles } from '@/src/lib/tunisian'
import { activeMoments, MOMENT_IDS } from '@/src/lib/moments'

// /sitemap.xml: tells search engines which pages exist. Rebuilt at most once a day.
export const revalidate = 86400

const SITE = `https://${SITE_HOST}`
const PAGES_PER_LIST = 5 // 20 titles per TMDB page

type Kind = 'movie' | 'tv'

async function collectIds(kind: Kind): Promise<number[]> {
  const lists = [`trending/${kind}/week`, `${kind}/popular`, `${kind}/top_rated`]
  const requests = lists.flatMap((path) =>
    Array.from({ length: PAGES_PER_LIST }, (_, i) => tmdbFetchSafe<{ results: any[] }>(path, { page: i + 1 }, 86400))
  )
  const pages = await Promise.all(requests)
  return Array.from(new Set(pages.flatMap((page) => (page?.results ?? []).map((item) => item.id as number))))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [movieIds, tvIds, movieGenres, tvGenres, tunisian] = await Promise.all([
    collectIds('movie'),
    collectIds('tv'),
    tmdbFetchSafe<{ genres: { id: number }[] }>('genre/movie/list', {}, 86400),
    tmdbFetchSafe<{ genres: { id: number }[] }>('genre/tv/list', {}, 86400),
    getTunisianTitles(),
  ])

  const entry = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']) =>
    ({ url: `${SITE}${path}`, lastModified: now, changeFrequency, priority })

  return [
    entry('/', 1, 'daily'),
    entry('/tv', 0.9, 'daily'),
    entry('/tunisian', 0.9, 'daily'),
    entry('/discover', 0.8, 'daily'),
    entry('/top-rated', 0.7, 'weekly'),
    entry('/upcoming', 0.7, 'daily'),
    entry('/ramadan', 0.7, 'weekly'),
    // The moments on now rank higher than the ones out of season.
    ...MOMENT_IDS.filter((id) => id !== 'ramadan').map((id) => entry(`/moments/${id}`, activeMoments(false).some((moment) => moment.id === id) ? 0.7 : 0.3, 'daily')),
    ...(movieGenres?.genres ?? []).map((genre) => entry(`/genres/${genre.id}`, 0.5, 'weekly')),
    ...(tvGenres?.genres ?? []).map((genre) => entry(`/genres/${genre.id}?type=tv`, 0.5, 'weekly')),
    ...(tunisian ?? []).map((title) => entry(`/tunisian/${title.slug}`, 0.8, 'weekly')),
    ...movieIds.map((id) => entry(`/movie/${id}`, 0.6, 'weekly')),
    ...tvIds.map((id) => entry(`/tv/${id}`, 0.6, 'weekly')),
  ]
}
