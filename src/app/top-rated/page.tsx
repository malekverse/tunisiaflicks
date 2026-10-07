import Link from 'next/link'
import MediaGrid from '@/src/components/MediaGrid'
import PageNav from '@/src/components/PageNav'
import { getList, parsePage } from '@/src/lib/lists'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Top Rated | TunisiaFlicks' }

export default async function TopRatedPage({ searchParams }: { searchParams: { page?: string, type?: string } }) {
  const page = parsePage(searchParams.page)
  const kind = searchParams.type === 'tv' ? 'tv' : 'movie'
  const { results, totalPages, failed } = await getList(`${kind}/top_rated`, page)

  const tab = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium ${active ? 'bg-red-500 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-600 hover:text-white'}`

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-6'>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-6'>
        <h1 className='text-3xl sm:text-4xl font-bold'>Top Rated</h1>
        <div className='flex gap-2'>
          <Link href='/top-rated' className={tab(kind === 'movie')}>Movies</Link>
          <Link href='/top-rated?type=tv' className={tab(kind === 'tv')}>TV Shows</Link>
        </div>
      </div>
      {failed ? <p className='text-gray-400'>Couldn&apos;t load this list right now. Please try again in a moment.</p> : <MediaGrid items={results} kind={kind} />}
      <PageNav currentPage={page} totalPages={totalPages} />
    </div>
  )
}
