import Link from 'next/link'
import TmdbImage from '@/src/components/TmdbImage'
import { cn } from '@/src/lib/utils'

/**
 * A landscape picture door into a hub (the home "Beyond Hollywood" shelf, the /dramas doors, the
 * cross-links at the end of a hub). The whole tile is one link; the badge (a LiveDot, a count) is
 * plain content at the top end. The hub's accent ("r g b") only lights it: a glow from below and a
 * ring under the pointer. With no picture, the accent glow alone fills the frame.
 */
export default function HubTile({ href, title, line, picture, accent, badge, size = 'shelf' }: {
  href: string
  title: string
  line?: string
  picture: { kind: 'tmdb-backdrop' | 'url', src: string } | null
  accent: string
  badge?: React.ReactNode
  size?: 'shelf' | 'door'
}) {
  const door = size === 'door'
  return (
    <Link
      href={href}
      className="group/tile relative block aspect-video select-none overflow-hidden rounded-tile bg-white/[0.04] outline-none ring-1 ring-inset ring-white/[0.08] transition-transform duration-150 ease-out [-webkit-touch-callout:none] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-red-500"
    >
      {picture?.kind === 'tmdb-backdrop' && (
        <TmdbImage
          kind="backdrop"
          path={picture.src}
          alt=""
          fill
          sizes={door ? '(min-width: 1280px) 46vw, 92vw' : '(min-width: 1536px) 360px, (min-width: 640px) 320px, 74vw'}
          draggable={false}
          className="object-cover transition-transform duration-500 ease-out group-hover/tile:scale-[1.04]"
        />
      )}
      {picture?.kind === 'url' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/tile:scale-[1.04]"
        />
      )}

      {/* The hub's light, rising from the bottom start corner; stronger when there's no picture. */}
      <span
        aria-hidden
        className="absolute inset-0 [--glow-x:0%] rtl:[--glow-x:100%]"
        style={{ background: `radial-gradient(120% 90% at var(--glow-x) 115%, rgb(${accent} / ${picture ? 0.5 : 0.85}), transparent 62%)` }}
      />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      <span
        aria-hidden
        className="absolute inset-0 rounded-tile opacity-0 transition-opacity duration-300 ease-out group-hover/tile:opacity-100"
        style={{ boxShadow: `inset 0 0 0 2px rgb(${accent} / 0.9), inset 0 -60px 80px -40px rgb(${accent} / 0.35)` }}
      />

      {badge && <span className="absolute end-3 top-3 flex items-center">{badge}</span>}

      <span className={cn('absolute inset-x-0 bottom-0 block text-start', door ? 'p-5 sm:p-6' : 'p-4')}>
        <span
          dir="auto"
          className={cn(
            'block text-balance font-display font-bold leading-[1.02] text-white drop-shadow-[0_2px_18px_rgb(0_0_0/0.6)]',
            door ? 'text-[24px] sm:text-[28px]' : 'text-[20px] sm:text-[22px]',
          )}
        >
          {title}
        </span>
        {line && <span dir="auto" className="mt-1 line-clamp-2 block text-[13px] leading-snug text-white/70">{line}</span>}
      </span>
    </Link>
  )
}
