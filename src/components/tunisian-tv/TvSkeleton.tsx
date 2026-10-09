import { Skeleton } from '@/src/components/ui/skeleton'
import { LANDSCAPE_WIDTH } from '@/src/components/dramas/widths'
import { getT } from '@/src/lib/i18n/server'

function TileRow() {
  return (
    <section>
      <div className="page-x mb-3 sm:mb-4">
        <Skeleton className="h-6 w-52 rounded-full sm:h-7" />
      </div>
      <div className="page-x flex gap-3 overflow-hidden sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`shrink-0 ${LANDSCAPE_WIDTH}`}>
            <Skeleton className="aspect-video w-full rounded-tile" />
            <Skeleton className="mt-3 h-4 w-4/5 rounded-full" />
            <Skeleton className="mt-2 h-3 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  )
}

/** The shape of /tunisian/tv (and, with `channel`, of a channel page) while it loads. */
export default function TvSkeleton({ channel = false }: { channel?: boolean }) {
  return (
    <div className="pb-10" aria-busy="true" aria-label={getT()('common.loadingAria')}>
      <div className="page-x page-top pb-8">
        {channel ? (
          <>
            <Skeleton className="h-5 w-40 rounded-full" />
            <div className="mt-6 flex items-end gap-6">
              <Skeleton className="h-[88px] w-[88px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-[clamp(36px,5.4vw,72px)] w-[min(380px,80%)] rounded-2xl" />
                <Skeleton className="mt-4 h-4 w-[min(320px,70%)] rounded-full" />
              </div>
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-[clamp(40px,6.5vw,92px)] w-[min(460px,75%)] rounded-2xl" />
            <Skeleton className="mt-4 h-4 w-[min(560px,90%)] rounded-full" />
            <Skeleton className="mt-2 h-4 w-[min(380px,60%)] rounded-full" />
          </>
        )}
      </div>
      <div className="space-y-10 sm:space-y-12">
        {!channel && (
          <div className="page-x">
            <Skeleton className="aspect-video w-full rounded-stage md:aspect-[21/9] md:min-h-[420px]" />
          </div>
        )}
        <TileRow />
        <TileRow />
      </div>
    </div>
  )
}
