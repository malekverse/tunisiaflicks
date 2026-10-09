import { Skeleton } from '@/src/components/ui/skeleton'
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

/** A country's panel while it loads: the name, the three numbers, today's pick, a row. */
export function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-8 pt-2 xl:pt-8" aria-busy="true" aria-label={label}>
      <div className="page-x">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-[clamp(40px,5.2vw,68px)] w-[min(280px,65%)] rounded-2xl" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-14 rounded-full" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-3 w-[min(340px,85%)] rounded-full" />
      </div>
      <div className="page-x">
        <div className="flex gap-4 rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/[0.06] sm:p-5">
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

/** The index panel while it loads: the title, the intro, the first rows of the country list. */
export function IndexSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-8 pt-2 xl:pt-8" aria-busy="true" aria-label={label}>
      <div className="page-x space-y-4">
        <Skeleton className="h-[clamp(34px,5vw,64px)] w-[min(320px,70%)] rounded-2xl" />
        <Skeleton className="h-4 w-[min(420px,90%)] rounded-full" />
        <Skeleton className="h-4 w-[min(300px,70%)] rounded-full" />
      </div>
      <div className="page-x space-y-1">
        <Skeleton className="mb-4 h-6 w-36 rounded-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex h-[60px] items-center gap-3">
            <Skeleton className="h-12 w-8 shrink-0 rounded-[6px]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28 rounded-full" />
              <Skeleton className="h-3 w-40 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
