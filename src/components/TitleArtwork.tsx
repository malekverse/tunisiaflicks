// A movie or show without artwork (TMDB has no poster or backdrop, or it won't load): the title set
// like a poster, on a dark tile lit in a hue of its own, with the "A" as a faint watermark, instead
// of a stock "404" picture. The text sizes with the frame (container units), so the same tile works
// as a 140px card, a wide still and the detail page's backdrop. Server-safe: no hooks.
import { MARK_STROKES, MARK_VIEWBOX } from '@/src/components/brand/BrandMark'
import { hueOf } from '@/src/components/PersonInitials'
import { cn } from '@/src/lib/utils'

/** Fills its (positioned) parent, like a `fill` image. `wide`: a backdrop or a still, not a poster. */
export default function TitleArtwork({ title, wide = false, className }: { title?: string, wide?: boolean, className?: string }) {
  const name = title?.trim() ?? ''
  const hue = hueOf(name || 'TunisiaFlicks')
  return (
    <span
      aria-hidden
      className={cn('absolute inset-0 select-none overflow-hidden', className)}
      style={{
        containerType: 'size',
        background: `radial-gradient(130% 90% at 20% 0%, hsl(${hue} 34% 22%) 0%, hsl(${hue} 24% 11%) 50%, #0a0a0c 100%)`,
      }}
    >
      {/* Light from above, like every surface in the room. */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/40" />
      {/* The mark, large and faint, bleeding off the end edge. */}
      <svg
        viewBox={MARK_VIEWBOX}
        className="absolute -end-[14%] -top-[6%] h-auto rotate-[-8deg]"
        style={{ width: wide ? '46cqw' : '78cqw', fill: `hsl(${hue} 50% 70% / 0.07)` }}
      >
        {MARK_STROKES.map((d) => <path key={d} d={d} />)}
      </svg>
      {name && (
        <span
          dir="auto"
          className={cn(
            'absolute inset-x-0 bottom-0 line-clamp-4 break-words text-balance font-display font-extrabold leading-[1.02]',
            wide ? 'p-[6cqw] text-start' : 'p-[9cqw] text-start',
          )}
          style={{
            fontSize: wide ? 'clamp(12px, 7cqw, 64px)' : 'clamp(12px, 13cqw, 34px)',
            color: `hsl(${hue} 40% 92%)`,
            textShadow: '0 2px 18px rgb(0 0 0 / 0.5)',
          }}
        >
          {name}
        </span>
      )}
    </span>
  )
}
