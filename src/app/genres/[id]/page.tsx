import MediaGrid from '@/src/components/MediaGrid'
import PageNav from '@/src/components/PageNav'
import { getList, parsePage } from '@/src/lib/lists'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { createTranslator } from '@/src/lib/i18n'
import { getLocale } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function GenrePage({ params, searchParams }: { params: { id: string }, searchParams: { page?: string, type?: string } }) {
  const page = parsePage(searchParams.page)
  const kind = searchParams.type === 'tv' ? 'tv' : 'movie'
  const locale = getLocale()
  const t = createTranslator(locale)

  const [{ results, totalPages, failed }, genres] = await Promise.all([
    getList(`discover/${kind}`, page, { with_genres: params.id }),
    tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(`genre/${kind}/list`, { language: tmdbLanguage(locale) }, 86400),
  ])
  const genreName = genres?.genres.find((genre) => String(genre.id) === params.id)?.name

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-6'>
      <h1 className='text-3xl sm:text-4xl font-bold mb-6'>
        {t('genre.heading', { genre: genreName ?? t('genre.fallback'), kind: t(kind === 'tv' ? 'common.tvShows' : 'common.movies') })}
      </h1>
      {failed ? <p className='text-gray-400'>{t('genre.failed')}</p> : <MediaGrid items={results} kind={kind} />}
      <PageNav currentPage={page} totalPages={totalPages} />
    </div>
  )
}
