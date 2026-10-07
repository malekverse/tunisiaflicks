import { Clapperboard } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import { cardProps } from '@/src/lib/card-props'
import { T } from '@/src/components/I18nProvider'

type Kind = 'movie' | 'tv'

// Three posters across on a phone, more as the screen grows.
export const GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-x-4 sm:gap-y-8 2xl:grid-cols-[repeat(auto-fill,minmax(184px,1fr))]'

/** An empty state that says what's going on, in the interface's voice. */
export function EmptyState({ title, children, icon }: { title?: React.ReactNode, children?: React.ReactNode, icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-white/50">
        {icon ?? <Clapperboard aria-hidden className="h-6 w-6" />}
      </span>
      {title && <p className="mt-4 font-display text-xl font-bold text-white">{title}</p>}
      {children && <div className="mt-1.5 max-w-sm text-sm text-white/55">{children}</div>}
    </div>
  )
}

/** Responsive grid of poster cards for a TMDB results array (movies, TV shows, or mixed search results). */
export default function MediaGrid({ items, kind, showTypeBadge, notify }: { items?: any[], kind?: Kind, showTypeBadge?: boolean, notify?: boolean }) {
  const today = new Date().toISOString().slice(0, 10)
  const list = (items ?? []).filter((item) => item && (kind || item.media_type === 'movie' || item.media_type === 'tv'))

  if (list.length === 0) {
    return <EmptyState><T k='common.nothingToShow' /></EmptyState>
  }

  return (
    <div className={GRID_CLASS}>
      {list.map((item) => {
        const itemKind: Kind = kind ?? item.media_type
        const props = cardProps({ ...item, poster_path: item.poster_path || item.backdrop_path }, itemKind)
        return (
          <PosterCard
            key={`${itemKind}-${item.id}`}
            {...props}
            voteAverage={item.vote_average || 0}
            showTypeBadge={showTypeBadge}
            notify={notify && itemKind === 'movie' && (!props.releaseDate || props.releaseDate > today)}
          />
        )
      })}
    </div>
  )
}
