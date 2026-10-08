import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import SegmentedLinks from '@/src/components/browse/SegmentedLinks'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import RoomTint from '@/src/components/shell/RoomTint'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { getKidsMode } from '@/src/lib/profiles'
import { getTunisianTitles } from '@/src/lib/tunisian'
import type { TKey } from '@/src/lib/i18n'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

// The catalogue is cached for 30 minutes (see lib/tunisian.ts); rendering per request keeps a
// temporary outage of the source site from being frozen into a static page.
export const dynamic = 'force-dynamic'
export const generateMetadata = () => {
  const t = getT()
  return pageMetadata({ title: t('tunisian.title'), description: t('tunisian.subtitle'), path: '/tunisian', card: 'tunisian' })
}

const TABS: { label: TKey, value?: 'series' | 'movie' }[] = [
  { label: 'common.all', value: undefined },
  { label: 'tunisian.series', value: 'series' },
  { label: 'tunisian.movies', value: 'movie' },
]

// The flag's red, a touch deeper: the room glows Tunisian here.
const TUNISIAN_RED = '231 0 19'

/** Made in Tunisia: the catalogue of Tunisian series and films, under the crescent and star. */
export default async function TunisianPage({ searchParams }: { searchParams: { type?: string } }) {
  // The Tunisian catalogue has no age ratings, so Kids profiles can't be offered it.
  if (await getKidsMode()) return <KidsBlocked what='tunisian' />
  const titles = await getTunisianTitles()
  const t = getT()
  const type = searchParams.type === 'series' || searchParams.type === 'movie' ? searchParams.type : undefined
  const visible = titles?.filter((title) => !type || title.kind === type) ?? []

  return (
    <div className="pb-10">
      <RoomTint color={TUNISIAN_RED} />
      <header className="page-x page-top relative isolate overflow-hidden pb-8">
        <TunisiaMark className="pointer-events-none absolute -end-24 -top-10 -z-10 h-[420px] w-[420px] text-red-600/[0.13] sm:-end-10 sm:h-[560px] sm:w-[560px]" />
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="animate-focus-in">
            <h1 className="font-display text-[clamp(40px,6.5vw,92px)] font-extrabold leading-[0.92]">{t('tunisian.title')}</h1>
            <p className="mt-3 max-w-[56ch] text-[15px] text-white/60">{t('tunisian.subtitle')}</p>
          </div>
          <SegmentedLinks
            label={t('tunisian.typeSwitch')}
            items={TABS.map((item) => ({
              href: item.value ? `/tunisian?type=${item.value}` : '/tunisian',
              label: t(item.label),
              active: type === item.value,
            }))}
          />
        </div>

        <Link
          href="/tunisian/cinema"
          className="group pressable mt-8 flex items-center gap-4 overflow-hidden rounded-[22px] bg-gradient-to-r from-red-600/30 via-red-600/10 to-transparent p-4 ring-1 ring-red-500/25 transition-colors hover:ring-red-500/50 sm:p-5 rtl:bg-gradient-to-l"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-[0_0_30px_rgb(229_15_5/0.5)]">
            <TunisiaMark className="h-10 w-10" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl font-bold">{t('tnCinema.title')}</span>
            <span className="block text-sm text-white/65">{t('tnCinema.teaser')}</span>
          </span>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-white/60 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </header>

      <div className="page-x">
        {titles === null ? (
          <EmptyState>{t('tunisian.failed')}</EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState>{t('tunisian.empty')}</EmptyState>
        ) : (
          <>
            <p className="mb-5 text-[13px] text-white/45">{t('tunisian.count', { count: visible.length })}</p>
            <div className={GRID_CLASS}>
              {visible.map((title) => (
                <PosterCard
                  key={title.slug}
                  posterImg={title.poster}
                  title={title.title}
                  releaseDate={title.published}
                  externalImg
                  actions={false}
                  link={`/tunisian/${title.slug}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
