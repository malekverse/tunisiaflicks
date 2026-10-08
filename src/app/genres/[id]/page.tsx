import MediaGrid, { EmptyState } from '@/src/components/MediaGrid'
import PageHeader from '@/src/components/browse/PageHeader'
import SegmentedLinks from '@/src/components/browse/SegmentedLinks'
import PageNav from '@/src/components/PageNav'
import { getList, parsePage } from '@/src/lib/lists'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { createTranslator } from '@/src/lib/i18n'
import { getLocale } from '@/src/lib/i18n/server'
import { kidsDiscoverParams } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params, searchParams }: { params: { id: string }, searchParams: { type?: string } }) {
  const kind = searchParams.type === 'tv' ? 'tv' : 'movie'
  const locale = getLocale()
  const t = createTranslator(locale)
  const genres = await tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(`genre/${kind}/list`, { language: tmdbLanguage(locale) }, 86400)
  const genre = genres?.genres.find((item) => String(item.id) === params.id)?.name ?? t('genre.fallback')
  const kindLabel = t(kind === 'tv' ? 'common.tvShows' : 'common.movies')
  return pageMetadata({
    title: t('genre.heading', { genre, kind: kindLabel }),
    description: t('genre.subtitle', { kind: kindLabel }),
    path: `/genres/${params.id}${kind === 'tv' ? '?type=tv' : ''}`,
    card: 'discover',
  })
}

export default async function GenrePage({ params, searchParams }: { params: { id: string }, searchParams: { page?: string, type?: string } }) {
  const page = parsePage(searchParams.page)
  const kind = searchParams.type === 'tv' ? 'tv' : 'movie'
  const locale = getLocale()
  const t = createTranslator(locale)
  const kids = await getKidsMode()

  const [{ results, totalPages, failed }, genres] = await Promise.all([
    getList(`discover/${kind}`, page, kids ? kidsDiscoverParams(kind, { with_genres: params.id }) : { with_genres: params.id }),
    tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(`genre/${kind}/list`, { language: tmdbLanguage(locale) }, 86400),
  ])
  const genreName = genres?.genres.find((genre) => String(genre.id) === params.id)?.name

  const kindLabel = t(kind === 'tv' ? 'common.tvShows' : 'common.movies')
  return (
    <div className="pb-10">
      <PageHeader title={genreName ?? t('genre.fallback')} subtitle={t('genre.subtitle', { kind: kindLabel })}>
        <SegmentedLinks
          label={t('browse.typeSwitch')}
          items={[
            { href: `/genres/${params.id}`, label: t('common.movies'), active: kind === 'movie' },
            { href: `/genres/${params.id}?type=tv`, label: t('common.tvShows'), active: kind === 'tv' },
          ]}
        />
      </PageHeader>
      <div className="page-x">
        {failed ? <EmptyState>{t('genre.failed')}</EmptyState> : <MediaGrid items={results} kind={kind} />}
        <PageNav currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  )
}
