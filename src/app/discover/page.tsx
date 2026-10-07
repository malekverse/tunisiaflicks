import Link from 'next/link'
import DiscoverFilters from '@/src/components/DiscoverFilters'
import MediaGrid from '@/src/components/MediaGrid'
import PageNav from '@/src/components/PageNav'
import { getList, parsePage } from '@/src/lib/lists'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { createTranslator } from '@/src/lib/i18n'
import { getLocale, getT } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => ({ title: `${getT()('discover.title')} | TunisiaFlicks` })

type SearchParams = { page?: string, type?: string, genre?: string, year?: string, rating?: string, sort?: string }

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

  const [{ results, totalPages, failed }, genreList] = await Promise.all([
    getList(`discover/${kind}`, page, {
      ...sortParams,
      include_adult: false,
      with_genres: filters.genre,
      ...(filters.year ? { [kind === 'movie' ? 'primary_release_year' : 'first_air_date_year']: filters.year } : {}),
      'vote_average.gte': filters.rating,
    }),
    tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(`genre/${kind}/list`, { language: tmdbLanguage(locale) }, 86400),
  ])

  const tab = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium ${active ? 'bg-red-500 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-600 hover:text-white'}`

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-6'>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
        <h1 className='text-3xl sm:text-4xl font-bold'>{t('discover.title')}</h1>
        <div className='flex gap-2'>
          {/* Switching type resets the filters: genre ids differ between movies and TV. */}
          <Link href='/discover' className={tab(kind === 'movie')}>{t('common.movies')}</Link>
          <Link href='/discover?type=tv' className={tab(kind === 'tv')}>{t('common.tvShows')}</Link>
        </div>
      </div>
      <DiscoverFilters genres={genreList?.genres ?? []} values={filters} />
      {failed
        ? <p className='text-gray-400'>{t('common.listFailed')}</p>
        : results.length === 0
          ? <p className='text-gray-400 py-10 text-center'>{t('discover.noMatch')}</p>
          : <MediaGrid items={results} kind={kind} />}
      <PageNav currentPage={page} totalPages={totalPages} />
    </div>
  )
}
