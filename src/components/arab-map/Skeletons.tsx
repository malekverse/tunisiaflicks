import { Skeleton } from '@/src/components/ui/skeleton'
import { SectionHeader } from '@/src/components/rows/Row'
import { MAP_CELLS } from '@/src/lib/arab-map'
import { cn } from '@/src/lib/utils'

/** The map while its index loads: the same 22 squares in the same places, so nothing moves. */
export function MapSkeleton({ label }: { label: string }) {
  return (
    <div className="w-full" aria-busy="true" aria-label={label}>
      <div dir="ltr" className="grid grid-cols-9 gap-1 sm:gap-1.5 xl:gap-2">
        {MAP_CELLS.map((cell) => (
          <Skeleton
            key={cell.code}
            className="aspect-square rounded-[10px]"
            style={{ gridColumnStart: cell.x + 1, gridRowStart: cell.y + 1 }}
          />
        ))}
      </div>
      <div className="mt-3 flex min-h-[56px] flex-col justify-center gap-2 sm:mt-4">
        <Skeleton className="h-4 w-[min(300px,70%)] rounded-full" />
      </div>
    </div>
  )
}

const POSTER = 'w-[30vw] max-w-[140px] shrink-0 sm:w-[140px] xl:w-[128px] 2xl:w-[140px]'

/**
 * Under a country's title while TMDB answers: the three numbers, the source line, today's pick
 * and a row, laid out like the real thing (CountryStats, PickCard, PanelRow).
 */
export function CountryBodySkeleton({ label }: { /** Left out inside PanelSkeleton (it says it once). */ label?: string }) {
  return (
    <div className="space-y-10" aria-busy={label ? true : undefined} aria-label={label}>
      <div className="page-x">
        <div className="mb-4 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-6 sm:gap-x-8">
          {['w-12', 'w-12', 'w-24'].map((width, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className={cn('h-3 rounded-full', width)} />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-[min(340px,85%)] rounded-full" />
      </div>
      <div className="page-x">
        <div className="flex gap-4 rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/[0.06] sm:gap-5 sm:p-5">
          <Skeleton className="aspect-[2/3] w-[92px] shrink-0 rounded-poster sm:w-[104px]" />
          <div className="flex-1 space-y-2.5 pt-1">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-6 w-[70%] rounded-lg" />
            <Skeleton className="h-3 w-[50%] rounded-full" />
            <Skeleton className="h-3 w-[90%] rounded-full" />
            <div className="flex gap-2.5 pt-2">
              <Skeleton className="h-11 w-24 rounded-full" />
              <Skeleton className="h-11 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <PanelRowSkeleton />
    </div>
  )
}

/**
 * A country's panel before its page arrives (a tile was just chosen): the title's place and the
 * body's. Once the page's first bytes are in, the real title replaces the first half at once.
 */
export function PanelSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="page-x pt-1 xl:pt-8">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-[clamp(40px,5.2vw,68px)] w-[min(280px,65%)] rounded-2xl" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        </div>
      </div>
      <div className="mt-5">
        <CountryBodySkeleton />
      </div>
    </div>
  )
}

export function PanelRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="page-x"><Skeleton className="h-6 w-44 rounded-full" /></div>
      <div className="page-x flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={POSTER}>
            <Skeleton className="aspect-[2/3] w-full rounded-poster" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** One row of the country list while it loads (the same 60px as CountryList's rows). */
function CountryRowSkeleton() {
  return (
    <li className="flex h-[60px] items-center gap-3">
      <Skeleton className="h-12 w-8 shrink-0 rounded-[6px]" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28 rounded-full" />
        <Skeleton className="h-3 w-40 rounded-full" />
      </div>
    </li>
  )
}

/**
 * The index panel under its title while the day's index loads: 'All countries' (its real title)
 * and 22 rows, the exact height of the list that replaces them, so nothing under them moves.
 */
export function IndexBodySkeleton({ title, label }: { title: string, label?: string }) {
  return (
    <div aria-busy={label ? true : undefined} aria-label={label}>
      <section aria-label={title}>
        <SectionHeader title={title} />
        <ul className="page-x divide-y divide-white/[0.06]">
          {MAP_CELLS.map((cell) => <CountryRowSkeleton key={cell.code} />)}
        </ul>
      </section>
    </div>
  )
}

/** The index panel before its page arrives (back from a country): the title, the intro, the list. */
export function IndexSkeleton({ label, title }: { label: string, title: string }) {
  return (
    <div className="space-y-10 pt-1 xl:pt-8" aria-busy="true" aria-label={label}>
      <div className="page-x">
        <Skeleton className="h-[clamp(40px,5.2vw,68px)] w-[min(320px,70%)] rounded-2xl" />
        <Skeleton className="mt-4 h-4 w-[min(420px,90%)] rounded-full" />
        <Skeleton className="mt-2.5 h-4 w-[min(300px,70%)] rounded-full" />
      </div>
      <IndexBodySkeleton title={title} />
    </div>
  )
}
