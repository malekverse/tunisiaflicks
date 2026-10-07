import { Skeleton } from '@/src/components/ui/skeleton'
import { SkeletonLoader } from '@/src/components/PosterCard'
import { getT } from '@/src/lib/i18n/server'

// Same widths as ROW_WIDTH.poster in rows/Row.tsx (a client module, so not importable here).
const POSTER_WIDTH = 'w-[34vw] max-w-[150px] shrink-0 sm:w-[156px] sm:max-w-none lg:w-[168px] 2xl:w-[196px]'
const CHIP_WIDTHS = ['w-32', 'w-36', 'w-28', 'w-32', 'w-40', 'w-36', 'w-28', 'w-24', 'w-28', 'w-24', 'w-32', 'w-28']

/**
 * Shown instantly while a server-rendered page is being prepared. It has the home page's shape
 * (the billboard, the chip rail, rows of posters), so the real page lands where the eye already is.
 */
export default function Loading() {
  return (
    <div className="pb-6" aria-busy="true" aria-label={getT()('common.loadingAria')}>
      {/* Desktop: the billboard stage, full bleed, its text block at the bottom start. */}
      <div className="relative hidden h-[min(88svh,980px)] min-h-[600px] w-full overflow-hidden md:block">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div aria-hidden className="absolute inset-y-0 start-0 w-[70%] bg-gradient-to-r from-black/85 via-black/40 to-transparent rtl:bg-gradient-to-l" />
        <div className="page-x absolute inset-x-0 bottom-[clamp(120px,17vh,190px)]">
          <div className="max-w-[min(620px,52vw)]">
            <Skeleton className="h-3.5 w-36 rounded-full" />
            <Skeleton className="mt-5 h-[clamp(84px,14vh,170px)] w-[min(460px,40vw)] rounded-2xl" />
            <Skeleton className="mt-6 h-4 w-72 rounded-full" />
            <div className="mt-4 space-y-2.5">
              <Skeleton className="h-3.5 w-[90%] rounded-full" />
              <Skeleton className="h-3.5 w-[70%] rounded-full" />
            </div>
            <div className="mt-8 flex items-center gap-3">
              <Skeleton className="h-12 w-36 rounded-full" />
              <Skeleton className="h-12 w-40 rounded-full" />
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Phones: the poster deck, the middle card in front and its neighbours peeking in. */}
      <div className="pt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+6px)] md:hidden">
        <div className="flex justify-center gap-3 overflow-hidden pb-6 pt-2">
          {[0, 1, 2].map((card) => (
            <Skeleton
              key={card}
              className={card === 1
                ? 'aspect-[2/3] w-[min(80vw,380px)] shrink-0 rounded-[26px]'
                : 'aspect-[2/3] w-[min(80vw,380px)] shrink-0 scale-[0.93] rounded-[26px] opacity-60'}
            />
          ))}
        </div>
        <div aria-hidden className="flex justify-center gap-1.5">
          <span className="h-1.5 w-5 rounded-full bg-white/25" />
          {[0, 1, 2, 3].map((dot) => <span key={dot} className="h-1.5 w-1.5 rounded-full bg-white/15" />)}
        </div>
      </div>

      <div className="relative z-10 mt-6 space-y-10 sm:space-y-12 md:-mt-16">
        <div className="rail-x flex gap-2 overflow-hidden px-[var(--gutter)] py-1">
          {CHIP_WIDTHS.map((width, i) => <Skeleton key={i} className={`h-10 shrink-0 rounded-full ${width}`} />)}
        </div>

        {[0, 1, 2].map((row) => (
          <section key={row}>
            <div className="page-x mb-3 sm:mb-4">
              <Skeleton className={`h-6 rounded-full sm:h-7 ${row === 1 ? 'w-40' : 'w-56'}`} />
            </div>
            <div className="page-x flex gap-3 overflow-hidden sm:gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={POSTER_WIDTH}>
                  <SkeletonLoader />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
