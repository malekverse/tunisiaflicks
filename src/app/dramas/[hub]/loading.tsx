import { Skeleton } from '@/src/components/ui/skeleton'
import { SkeletonLoader } from '@/src/components/PosterCard'
import { POSTER_WIDTH } from '@/src/components/dramas/widths'
import { getT } from '@/src/lib/i18n/server'

const CHIP_WIDTHS = ['w-14', 'w-32', 'w-36', 'w-40', 'w-32', 'w-24']

/** A drama hub's shape while it loads: the title, the framed screen, the chips, a row. */
export default function Loading() {
  return (
    <div className="pb-10" aria-busy="true" aria-label={getT()('common.loadingAria')}>
      <div className="page-x page-top pb-5 sm:pb-6">
        <Skeleton className="h-[clamp(36px,5.4vw,72px)] w-[min(420px,70%)] rounded-2xl" />
        <Skeleton className="mt-4 h-4 w-[min(520px,85%)] rounded-full" />
      </div>
      <div className="page-x">
        <Skeleton className="-mx-[var(--gutter)] aspect-[16/10] rounded-none md:mx-0 md:aspect-auto md:h-[clamp(440px,42vw,640px)] md:rounded-stage" />
      </div>
      <div className="page-x mt-6 flex gap-2 overflow-hidden py-1 sm:mt-8">
        {CHIP_WIDTHS.map((width, i) => <Skeleton key={i} className={`h-10 shrink-0 rounded-full ${width}`} />)}
      </div>
      <section className="mt-8 sm:mt-10">
        <div className="page-x mb-3 sm:mb-4">
          <Skeleton className="h-6 w-56 rounded-full sm:h-7" />
        </div>
        <div className="page-x flex gap-3 overflow-hidden sm:gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`shrink-0 ${POSTER_WIDTH}`}>
              <SkeletonLoader />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
