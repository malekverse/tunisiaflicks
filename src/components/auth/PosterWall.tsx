"use client"
import { useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '@/src/lib/utils'
import { TMDB_IMAGE_BASE } from '@/src/lib/tmdb-image'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// Every column drifts at its own pace, every other one the other way, each starting somewhere else
// along its loop so no two rows of posters line up.
const COLUMNS: { duration: number, delay: number, reverse?: boolean, className?: string }[] = [
  { duration: 130, delay: -18 },
  { duration: 100, delay: -61, reverse: true },
  { duration: 150, delay: -97 },
  { duration: 115, delay: -40, reverse: true, className: 'max-lg:hidden' },
]

// Where the wall was when the last one left the screen. Login, sign-up and the password pages all
// show the same wall, so the next one picks the drift up from there instead of snapping back.
let handoff: { at: number, times: (number | null)[] } | null = null

/** How far (ms) a column is into its loop. */
function activeTime(column: HTMLElement): number | null {
  const animation = column.getAnimations?.()[0]
  if (!animation || typeof animation.currentTime !== 'number') return null
  const delay = Number(animation.effect?.getTiming().delay ?? 0)
  return animation.currentTime - delay
}

/**
 * The sign-in pages' backdrop: columns of this week's posters drifting endlessly (each column holds
 * its list twice and slides by half its height, so the loop has no seam), tilted a few degrees.
 * Pure CSS animation on the compositor; static for people who prefer less motion.
 */
export default function PosterWall({ posters, className }: { posters: string[], className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useIsomorphicLayoutEffect(() => {
    const columns = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-wall-column]') ?? [])
    if (handoff) {
      const elapsed = performance.now() - handoff.at
      const times = handoff.times
      columns.forEach((column, index) => {
        const time = times[index]
        if (time == null) return
        column.style.animationDelay = `${-(((time + elapsed) / 1000) % COLUMNS[index].duration)}s`
      })
    }
    return () => {
      handoff = { at: performance.now(), times: columns.map(activeTime) }
    }
  }, [])

  if (posters.length === 0) return null

  return (
    <div ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 select-none overflow-hidden', className)}>
      <div className="absolute inset-x-[-14%] inset-y-[-20%] grid -rotate-[8deg] grid-cols-3 gap-3 rtl:rotate-[8deg] lg:inset-x-[-9%] lg:grid-cols-4 lg:gap-4">
        {COLUMNS.map((column, index) => {
          const list = posters.filter((_, i) => i % COLUMNS.length === index)
          return (
            <div key={index} className={cn('min-w-0', column.className)}>
              <div
                data-wall-column
                className="animate-poster-wall will-change-transform motion-reduce:animate-none"
                style={{
                  animationDuration: `${column.duration}s`,
                  animationDelay: `${column.delay}s`,
                  animationDirection: column.reverse ? 'reverse' : 'normal',
                }}
              >
                {/* Bottom padding instead of a gap: both halves are exactly the same height. */}
                {[...list, ...list].map((path, i) => (
                  <div key={i} className="pb-3 lg:pb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${TMDB_IMAGE_BASE}/w342${path}`}
                      srcSet={`${TMDB_IMAGE_BASE}/w185${path} 185w, ${TMDB_IMAGE_BASE}/w342${path} 342w, ${TMDB_IMAGE_BASE}/w500${path} 500w`}
                      sizes="(min-width: 1024px) 18vw, 40vw"
                      alt=""
                      loading={i < 3 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                      className="aspect-[2/3] w-full rounded-poster bg-white/[0.04] object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
