"use client"
import { m } from 'framer-motion'
import { Heart, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'

// Where each card lands once the fan is dealt. The gesture is physical in every language: the card
// thrown left is a "nope", the one thrown right a "yes".
const SPOTS = [
  { x: '-44%', y: '7%', rotate: -11, z: 1, delay: 0.1, stamp: 'nope' as const },
  { x: '44%', y: '7%', rotate: 11, z: 2, delay: 0.16, stamp: 'like' as const },
  { x: '0%', y: '0%', rotate: 0, z: 3, delay: 0, stamp: null },
]

/**
 * Three posters dealt into a fan, the way the game plays: one thrown left, one thrown right, one in
 * the middle waiting for a verdict. Decorative; scales with its box (give it a width).
 */
export default function PosterFan({ posters, sizes, className, priority = false }: {
  posters: (string | null | undefined)[]
  sizes: string
  className?: string
  priority?: boolean
}) {
  return (
    <div aria-hidden className={cn('relative aspect-[10/9] select-none', className)}>
      {SPOTS.map((spot, index) => (
        <m.div
          key={index}
          initial={{ x: '0%', y: '4%', rotate: 0, scale: 0.94, opacity: 0 }}
          animate={{ x: spot.x, y: spot.y, rotate: spot.rotate, scale: 1, opacity: 1 }}
          transition={{ ...spring.momentum, delay: 0.12 + spot.delay, opacity: { duration: 0.3, delay: 0.12 + spot.delay } }}
          style={{ zIndex: spot.z }}
          className="absolute inset-x-0 top-[3%] mx-auto aspect-[2/3] w-[56%]"
        >
          <div className="relative h-full w-full overflow-hidden rounded-[8%/5.3%] bg-white/[0.06] shadow-[0_24px_60px_-18px_rgb(0_0_0/0.9)] ring-1 ring-white/10">
            {posters[index] && (
              <TmdbImage kind="poster" path={posters[index]} fill sizes={sizes} alt="" priority={priority} draggable={false} className="object-cover" />
            )}
            {spot.stamp === 'nope' && <div className="absolute inset-0 bg-black/35" />}
          </div>
          {spot.stamp && (
            <span
              className={cn(
                'absolute top-[-6%] grid aspect-square w-[25%] place-items-center rounded-full ring-[3px] ring-black',
                spot.stamp === 'like' ? 'right-[-8%] bg-red-600 text-white shadow-[0_8px_24px_-6px_rgb(229_15_5/0.8)]' : 'left-[-8%] bg-white text-black',
              )}
            >
              {spot.stamp === 'like'
                ? <Heart className="h-1/2 w-1/2 fill-current" strokeWidth={2} />
                : <X className="h-1/2 w-1/2" strokeWidth={2.6} />}
            </span>
          )}
        </m.div>
      ))}
    </div>
  )
}
