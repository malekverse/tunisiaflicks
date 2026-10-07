import { Skeleton } from '@/src/components/ui/skeleton'
import { getT } from '@/src/lib/i18n/server'

// Shown instantly while a server-rendered page (home, TV, lists...) is being prepared, in place of
// the old full-screen spinner that blocked every navigation for half a second.
export default function Loading() {
  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-14 space-y-6' aria-busy='true' aria-label={getT()('common.loadingAria')}>
      <div className='flex gap-3 overflow-hidden'>
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className='h-9 w-24 shrink-0 rounded-xl' />)}
      </div>
      <Skeleton className='h-8 w-56' />
      <div className='flex gap-4 overflow-hidden'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-[200px] sm:h-[272px] lg:h-[310px] w-[300px] sm:w-[400px] lg:w-[500px] shrink-0 rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-8 w-48' />
      <div className='flex gap-4 overflow-hidden'>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className='aspect-[2/3] w-[145px] md:w-[167px] shrink-0 rounded-xl' />)}
      </div>
    </div>
  )
}
