import { ListVideo } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { cn } from '@/src/lib/utils'

// Where each poster of the fan sits: start, middle (in front), end. It opens up a little when the
// card around it (`group/cover`) is hovered.
const FAN = {
  start: 'z-0 -translate-x-[60%] -rotate-[8deg] rtl:translate-x-[60%] rtl:rotate-[8deg] group-hover/cover:-translate-x-[70%] group-hover/cover:-rotate-[10deg] rtl:group-hover/cover:translate-x-[70%] rtl:group-hover/cover:rotate-[10deg]',
  middle: 'z-10 group-hover/cover:-translate-y-1.5',
  end: 'z-0 translate-x-[60%] rotate-[8deg] rtl:-translate-x-[60%] rtl:-rotate-[8deg] group-hover/cover:translate-x-[70%] group-hover/cover:rotate-[10deg] rtl:group-hover/cover:-translate-x-[70%] rtl:group-hover/cover:-rotate-[10deg]',
}

/**
 * A list's cover: its first posters fanned out over a soft glow of the first one (the screen is
 * the only light in the room). An empty list shows an empty frame.
 */
export default function ListCover({ posters, emptyLabel, className, priority }: {
  posters: (string | null | undefined)[]
  emptyLabel?: string
  className?: string
  priority?: boolean
}) {
  const paths = posters.filter(Boolean).slice(0, 3) as string[]
  const slots: (keyof typeof FAN)[] = paths.length === 1 ? ['middle'] : paths.length === 2 ? ['start', 'end'] : ['middle', 'start', 'end']

  return (
    <div className={cn('relative isolate aspect-[4/3] w-full overflow-hidden rounded-tile bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]', className)}>
      {paths[0] && (
        <div aria-hidden className="absolute inset-0 -z-10 opacity-60">
          <TmdbImage kind="poster" path={paths[0]} alt="" fill sizes="80px" shimmer={false} className="scale-150 object-cover blur-2xl saturate-150" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        </div>
      )}
      {paths.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-white/45">
          <span className="grid aspect-[2/3] h-[46%] place-items-center rounded-poster border border-dashed border-white/15 bg-white/[0.03]">
            <ListVideo aria-hidden className="h-6 w-6" strokeWidth={1.7} />
          </span>
          {emptyLabel && <span className="text-[12.5px]">{emptyLabel}</span>}
        </div>
      ) : (
        paths.map((path, index) => (
          <div key={`${path}-${index}`} aria-hidden className={cn('absolute inset-0 grid place-items-center', slots[index] === 'middle' ? 'z-10' : 'z-0')}>
            <span
              className={cn(
                'relative block aspect-[2/3] h-[74%] overflow-hidden rounded-poster bg-white/[0.06] shadow-[0_18px_40px_-12px_rgb(0_0_0/0.95)] ring-1 ring-inset ring-white/10 transition-transform duration-500 ease-out',
                FAN[slots[index]],
              )}
            >
              <TmdbImage kind="poster" path={path} alt="" fill sizes="140px" priority={priority} className="object-cover" />
            </span>
          </div>
        ))
      )}
    </div>
  )
}
