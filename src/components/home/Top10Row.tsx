import PosterCard from '@/src/components/PosterCard'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { cardProps } from '@/src/lib/card-props'
import { getT } from '@/src/lib/i18n/server'
import type { Top10 } from '@/src/lib/top10'

/** Ten posters, each standing on its rank in huge outlined numerals. */
export default function Top10Row({ top10 }: { top10: Top10 }) {
  const t = getT()
  if (top10.items.length < 5) return null
  const title = top10.source === 'site' ? t('home.top10Site') : t('home.top10World')
  return (
    <section aria-label={title}>
      <SectionHeader title={title} subtitle={top10.source === 'site' ? t('home.top10SiteNote') : t('home.top10WorldNote')} />
      <Row label={title} gap="gap-1 sm:gap-2" itemClassName="w-[50vw] max-w-[220px] sm:w-[236px] sm:max-w-none lg:w-[256px] 2xl:w-[290px]">
        {top10.items.map((item, index) => {
          const kind: 'movie' | 'tv' = item.media_type === 'tv' ? 'tv' : 'movie'
          return (
            <div key={`${kind}-${item.id}`} className="group/rank flex items-end">
              <span
                aria-label={t('home.rank', { rank: index + 1 })}
                className="numeral-outline relative -me-[3%] w-[48%] shrink-0 select-none text-end font-display text-[clamp(150px,15.5vw,236px)] font-extrabold leading-[0.72] tracking-[-0.09em] transition-[-webkit-text-stroke-color] duration-300 group-hover/rank:[-webkit-text-stroke-color:rgb(255_36_20/0.85)]"
              >
                {index + 1}
              </span>
              <div className="relative w-[55%] shrink-0">
                <PosterCard {...cardProps(item, kind)} bare />
              </div>
            </div>
          )
        })}
      </Row>
    </section>
  )
}
