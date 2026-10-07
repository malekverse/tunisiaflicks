import MediaGrid from '@/src/components/MediaGrid'
import PageNav from '@/src/components/PageNav'
import { getList, parsePage } from '@/src/lib/lists'
import { getT } from '@/src/lib/i18n/server'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => ({ title: `${getT()('upcoming.title')} | TunisiaFlicks` })

export default async function UpcomingPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = parsePage(searchParams.page)
  const { results, totalPages, failed } = await getList('movie/upcoming', page)
  const t = getT()

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-6'>
      <h1 className='text-3xl sm:text-4xl font-bold mb-6'>{t('upcoming.title')}</h1>
      {failed ? <p className='text-gray-400'>{t('upcoming.failed')}</p> : <MediaGrid items={results} kind='movie' />}
      <PageNav currentPage={page} totalPages={totalPages} />
    </div>
  )
}
