import PosterCard from '@/src/components/PosterCard'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import PageHeader from '@/src/components/browse/PageHeader'
import SegmentedLinks from '@/src/components/browse/SegmentedLinks'
import { cardProps } from '@/src/lib/card-props'
import PageNav from '@/src/components/PageNav'
import { getList, parsePage } from '@/src/lib/lists'
import { getT } from '@/src/lib/i18n/server'
import { kidsList } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => {
  const t = getT()
  return pageMetadata({ title: t('topRated.title'), description: t('topRated.subtitle'), path: '/top-rated', card: 'top-rated' })
}

export default async function TopRatedPage({ searchParams }: { searchParams: { page?: string, type?: string } }) {
  const page = parsePage(searchParams.page)
  const kind = searchParams.type === 'tv' ? 'tv' : 'movie'
  const kids = kidsList(kind, 'top_rated')
  const { results, totalPages, failed } = await getKidsMode()
    ? await getList(kids.path, page, kids.params)
    : await getList(`${kind}/top_rated`, page)
  const t = getT()

  const offset = (page - 1) * 20

  return (
    <div className="pb-10">
      <PageHeader title={t('topRated.title')} subtitle={t('topRated.subtitle')}>
        <SegmentedLinks
          label={t('browse.typeSwitch')}
          items={[
            { href: '/top-rated', label: t('common.movies'), active: kind === 'movie' },
            { href: '/top-rated?type=tv', label: t('common.tvShows'), active: kind === 'tv' },
          ]}
        />
      </PageHeader>
      <div className="page-x">
        {failed ? <EmptyState>{t('common.listFailed')}</EmptyState> : (
          <ol className={GRID_CLASS}>
            {results.map((item: any, index: number) => (
              <li key={item.id}>
                <PosterCard
                  {...cardProps(item, kind)}
                  overlay={
                    <span className="absolute start-2 top-2 grid h-8 min-w-8 place-items-center rounded-full bg-black/70 px-2 font-display text-[15px] font-extrabold text-white ring-1 ring-white/15 backdrop-blur-md">
                      {offset + index + 1}
                    </span>
                  }
                />
              </li>
            ))}
          </ol>
        )}
        <PageNav currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  )
}
