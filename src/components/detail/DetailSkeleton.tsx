import { Skeleton } from '@/src/components/ui/skeleton'
import { getT } from '@/src/lib/i18n/server'

/** While a movie / show page loads: the hero's shape (picture, title, actions), then the player. */
export default function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label={getT()('common.loadingAria')} className="pb-10">
      <div className="relative">
        <div className="tf-shimmer relative aspect-[5/4] w-full sm:aspect-video md:aspect-auto md:h-[min(92svh,980px)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black to-transparent" />
        <div className="page-x relative -mt-28 space-y-4 md:absolute md:inset-x-0 md:bottom-[clamp(48px,8vh,100px)] md:mt-0">
          <Skeleton className="h-[clamp(64px,10vh,120px)] w-[min(80%,460px)] rounded-2xl" />
          <Skeleton className="h-4 w-64 rounded-full" />
          <Skeleton className="h-4 w-[min(90%,560px)] rounded-full" />
          <Skeleton className="h-4 w-[min(70%,420px)] rounded-full" />
          <div className="flex gap-3 pt-3">
            <Skeleton className="h-12 w-36 rounded-full" />
            <Skeleton className="h-12 w-32 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
      </div>
      <div className="page-x mt-16">
        <Skeleton className="mx-auto aspect-video w-full max-w-[1400px] rounded-[22px]" />
      </div>
    </div>
  )
}
