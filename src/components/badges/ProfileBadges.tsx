// The badge shelf and weekly streak on a profile page (/me, /u/[handle]), as the owner sees it or
// as others may (the page decides who may see it at all: canSee(viewer, owner, 'badges')).
// Streams in on its own: the owner sees a quiet placeholder while it loads (a computation may fetch
// a few TMDB facts, never more than 3 seconds); others see nothing until it's there, and nothing at
// all when there's nothing for them.
import { Suspense } from 'react'
import { Skeleton } from '@/src/components/ui/skeleton'
import { getBadgesView, type BadgesView } from '@/src/lib/badges/view'
import type { ProfileRef } from '@/src/lib/social/types'
import { withTimeout } from '@/src/lib/with-timeout'
import BadgeShelf from './BadgeShelf'

/** Most of a computation's time is the TMDB facts; the view gives up a little after and shows what's stored. */
const BUDGET_MS = { owner: 2800, public: 1500 }

function ShelfPlaceholder() {
  return (
    <section aria-busy className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6">
      <Skeleton className="h-6 w-28 rounded-full" />
      <div className="mt-6 flex gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2.5">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-3 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  )
}

async function Shelf({ owner, view }: { owner: ProfileRef; view: 'owner' | 'public' }) {
  const data = await withTimeout<BadgesView | null | 'failed'>(
    getBadgesView(owner, { view, budgetMs: BUDGET_MS[view] }).catch((error) => {
      console.error('ProfileBadges: loading the shelf failed', error)
      return 'failed' as const
    }),
    BUDGET_MS[view] + 2500,
    'failed',
  )
  // The owner hears that it failed (with Try again); anyone else simply sees no shelf.
  if (data === 'failed') return view === 'owner' ? <BadgeShelf data={null} error /> : null
  // No such profile (anymore).
  if (!data) return null
  return <BadgeShelf data={data} />
}

export default async function ProfileBadges(props: { owner: ProfileRef; view: 'owner' | 'public' }): Promise<JSX.Element | null> {
  const view = props.view === 'owner' ? 'owner' : 'public'
  return (
    <Suspense fallback={view === 'owner' ? <ShelfPlaceholder /> : null}>
      <Shelf owner={props.owner} view={view} />
    </Suspense>
  )
}
