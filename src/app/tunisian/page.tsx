import Link from 'next/link'
import PosterCard from '@/src/components/PosterCard'
import { GRID_CLASS } from '@/src/components/MediaGrid'
import { getTunisianTitles } from '@/src/lib/tunisian'
import type { TKey } from '@/src/lib/i18n'
import { getT } from '@/src/lib/i18n/server'

// The catalogue is cached for 30 minutes (see lib/tunisian.ts); rendering per request keeps a
// temporary outage of the source site from being frozen into a static page.
export const dynamic = 'force-dynamic'
export const generateMetadata = () => ({ title: `${getT()('tunisian.metaTitle')} | TunisiaFlicks` })

const TABS: { label: TKey, value?: 'series' | 'movie' }[] = [
  { label: 'common.all', value: undefined },
  { label: 'tunisian.series', value: 'series' },
  { label: 'tunisian.movies', value: 'movie' },
]

export default async function TunisianPage({ searchParams }: { searchParams: { type?: string } }) {
  const titles = await getTunisianTitles()
  const t = getT()
  const type = searchParams.type === 'series' || searchParams.type === 'movie' ? searchParams.type : undefined
  const visible = titles?.filter((title) => !type || title.kind === type) ?? []

  const tab = (active: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium ${active ? 'bg-red-500 text-white' : 'bg-zinc-800 text-gray-300 hover:bg-zinc-600 hover:text-white'}`

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-6'>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-6'>
        <h1 className='text-3xl sm:text-4xl font-bold'>{t('tunisian.title')}</h1>
        <div className='flex gap-2'>
          {TABS.map((item) => (
            <Link key={item.label} href={item.value ? `/tunisian?type=${item.value}` : '/tunisian'} className={tab(type === item.value)}>
              {t(item.label)}
            </Link>
          ))}
        </div>
      </div>

      {titles === null ? (
        <p className='text-gray-400'>{t('tunisian.failed')}</p>
      ) : visible.length === 0 ? (
        <p className='text-gray-400'>{t('tunisian.empty')}</p>
      ) : (
        <div className={GRID_CLASS}>
          {visible.map((title) => (
            <div key={title.slug} className='transition-transform ease-in-out duration-300 hover:scale-105 hover:z-10'>
              <PosterCard
                posterImg={title.poster}
                title={title.title}
                releaseDate={title.published}
                externalImg
                actions={false}
                link={`/tunisian/${title.slug}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
