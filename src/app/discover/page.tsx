import DiscoverFilters from '@/src/components/DiscoverFilters'
import MediaGrid, { EmptyState } from '@/src/components/MediaGrid'
import PageHeader from '@/src/components/browse/PageHeader'
import SegmentedLinks from '@/src/components/browse/SegmentedLinks'
import PageNav from '@/src/components/PageNav'
import { getList, parsePage } from '@/src/lib/lists'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { createTranslator } from '@/src/lib/i18n'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { kidsDiscoverParams } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => ({ title: `${getT()('discover.title')} | TunisiaFlicks` })

type SearchParams = { page?: string, type?: string, genre?: string, year?: string, rating?: string, sort?: string, runtime?: string, family?: string }

/** Runtime filter (episode length for TV): under 90 min, under 2 h, or a 2.5 h+ epic. */
function runtimeParams(kind: 'movie' | 'tv', runtime?: string): Record<string, number> {
  const floor = kind === 'movie' ? 60 : 15
  if (runtime === '90') return kind === 'movie' ? { 'with_runtime.gte': floor, 'with_runtime.lte': 95 } : { 'with_runtime.gte': floor, 'with_runtime.lte': 30 }
  if (runtime === '120') return kind === 'movie' ? { 'with_runtime.gte': floor, 'with_runtime.lte': 120 } : { 'with_runtime.gte': floor, 'with_runtime.lte': 50 }
  if (runtime === 'epic') return kind === 'movie' ? { 'with_runtime.gte': 150 } : { 'with_runtime.gte': 55 }
  return {}
}

// Only well-formed values reach TMDB; anything else is ignored.
function parseFilters(searchParams: SearchParams) {
  const currentYear = new Date().getFullYear()
  const year = /^\d{4}$/.test(searchParams.year ?? '') && Number(searchParams.year) >= 1900 && Number(searchParams.year) <= currentYear + 1
    ? searchParams.year : undefined
  return {
    genre: /^\d+$/.test(searchParams.genre ?? '') ? searchParams.genre : undefined,
    year,
    rating: ['6', '7', '8'].includes(searchParams.rating ?? '') ? searchParams.rating : undefined,
    sort: ['top', 'newest'].includes(searchParams.sort ?? '') ? searchParams.sort! : 'popular',
    runtime: ['90', '120', 'epic'].includes(searchParams.runtime ?? '') ? searchParams.runtime : undefined,
    family: searchParams.family === '1' ? '1' : undefined,
  }
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePage(searchParams.page)
  const kind = searchParams.type === 'tv' ? 'tv' : 'movie'
  const filters = parseFilters(searchParams)
  const locale = getLocale()
  const t = createTranslator(locale)

  const dateField = kind === 'movie' ? 'primary_release_date' : 'first_air_date'
  const today = new Date().toISOString().slice(0, 10)
  const sortParams: Record<string, string | number> =
    filters.sort === 'top'
      ? { sort_by: 'vote_average.desc', 'vote_count.gte': 300 }
      : filters.sort === 'newest'
        // Newest *released*: TMDB otherwise lists far-future placeholders first.
        ? { sort_by: `${dateField}.desc`, [`${dateField}.lte`]: today, 'vote_count.gte': 20 }
        : { sort_by: 'popularity.desc', 'vote_count.gte': 100 }

  const params = {
    ...sortParams,
    include_adult: false,
    with_genres: filters.genre,
    ...(filters.year ? { [kind === 'movie' ? 'primary_release_year' : 'first_air_date_year']: filters.year } : {}),
    'vote_average.gte': filters.rating,
    // "I have 90 minutes": TMDB lists unknown runtimes as 0, so short filters also need a floor.
    ...runtimeParams(kind, filters.runtime),
  }
  const kids = await getKidsMode()
  // "Family-friendly" uses the same rating rules as Kids profiles.
  const familyOnly = kids || filters.family === '1'

  const [{ results, totalPages, failed }, genreList] = await Promise.all([
    getList(`discover/${kind}`, page, familyOnly ? kidsDiscoverParams(kind, params) : params),
    tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(`genre/${kind}/list`, { language: tmdbLanguage(locale) }, 86400),
  ])

  return (
    <div className="pb-10">
      <PageHeader title={t('discover.title')} subtitle={t('discover.subtitle')}>
        {/* Switching type resets the filters: genre ids differ between movies and TV. */}
        <SegmentedLinks
          label={t('browse.typeSwitch')}
          items={[
            { href: '/discover', label: t('common.movies'), active: kind === 'movie' },
            { href: '/discover?type=tv', label: t('common.tvShows'), active: kind === 'tv' },
          ]}
        />
      </PageHeader>
      <DiscoverFilters genres={genreList?.genres ?? []} values={filters} />
      <div className="page-x mt-8">
        {failed
          ? <EmptyState>{t('common.listFailed')}</EmptyState>
          : results.length === 0
            ? <EmptyState>{t('discover.noMatch')}</EmptyState>
            : <MediaGrid items={results} kind={kind} />}
        <PageNav currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  )
}
