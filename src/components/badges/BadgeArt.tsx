// One badge medallion (44, 64 or 160 px): the same drawing as /badges/art/{id}-{level}.svg, inline
// so locked badges can show their progress arc. Decorative: the badge's name is always written next
// to it. Server-safe (no hooks).
import { badgeSvg } from '@/src/lib/badges/art'
import type { BadgeId, Tier } from '@/src/lib/badges/catalogue'
import { cn } from '@/src/lib/utils'

export default function BadgeArt({ id, level, size = 64, progress, arcTier, className }: {
  id: BadgeId
  level: number
  size?: 44 | 56 | 64 | 120 | 160
  /** Locked art: how far along the next level is (0..1). */
  progress?: number
  arcTier?: Tier | null
  className?: string
}) {
  // Deterministic ids: the same badge drawn twice shares identical gradients, which is harmless.
  const uid = `ba-${id}-${level}-${size}`
  return (
    <span
      aria-hidden
      className={cn('block shrink-0 [&>svg]:block', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: badgeSvg({ id, level, size, progress, arcTier, uid }) }}
    />
  )
}
