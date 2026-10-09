"use client"
// A picture of the desktop app, drawn in HTML so it is sharp at any size and in every language: its
// window, a film playing in the TunisiaFlicks player with the source bar under it (the local player
// first, as in the app), and a pop-up it has just blocked. One label for the whole picture.
import { Check, Maximize, Minus, Pause, ShieldBan, ShieldCheck, Square, Volume2, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { BrandMark } from '@/src/components/brand/BrandMark'
import { useT } from '@/src/components/I18nProvider'
import { LOCAL_PLAYER_SOURCE } from '@/src/hooks/use-desktop-app'
import type { ShowcaseFilm } from '@/src/lib/desktop-showcase'
import { cn } from '@/src/lib/utils'

const OTHER_SOURCES = ['VidSrc', 'VidLink', 'VidSrc.su']

export default function AppWindowMock({ film, compact = false, priority = false, className }: {
  film: ShowcaseFilm | null
  /** Smaller: no film title, no blocked pop-up (the spotlight on /app). */
  compact?: boolean
  priority?: boolean
  className?: string
}) {
  const t = useT()
  return (
    <div role="img" aria-label={t('desktop.mock.alt')} className={cn('relative', className)}>
      <div className="overflow-hidden rounded-[14px] bg-[#0c0c0c] shadow-[0_50px_120px_-40px_rgb(0_0_0/1)] ring-1 ring-white/[0.12] sm:rounded-[16px]">
        {/* The title bar, Windows style. */}
        <div className={cn('flex items-center gap-2 border-b border-white/[0.06] ps-3.5', compact ? 'h-7' : 'h-9')}>
          <BrandMark className={compact ? 'h-3 w-auto' : 'h-3.5 w-auto'} />
          <span className="text-[12px] font-medium text-white/60">TunisiaFlicks</span>
          <span aria-hidden className="ms-auto flex h-full text-white/50">
            <span className={cn('grid h-full place-items-center', compact ? 'w-8' : 'w-11')}><Minus className="h-3.5 w-3.5" strokeWidth={1.6} /></span>
            <span className={cn('grid h-full place-items-center', compact ? 'w-8' : 'w-11')}><Square className="h-3 w-3" strokeWidth={1.6} /></span>
            <span className={cn('grid h-full place-items-center', compact ? 'w-8' : 'w-11')}><X className="h-3.5 w-3.5" strokeWidth={1.6} /></span>
          </span>
        </div>

        <div className={compact ? 'p-2' : 'p-2.5 sm:p-4'}>
          {/* The player, a film playing. */}
          <div className="relative aspect-video overflow-hidden rounded-[10px] bg-black ring-1 ring-white/[0.08]">
            {film ? (
              <TmdbImage kind="backdrop" path={film.backdrop} alt="" fill priority={priority} sizes={compact ? '320px' : '(min-width: 1024px) 720px, 100vw'} className="object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(70%_70%_at_50%_40%,rgb(255_36_20/0.22),transparent_70%)]">
                <BrandMark className="h-12 w-auto opacity-70" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/35" />
            <span className="absolute start-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-medium text-emerald-300 ring-1 ring-white/10 backdrop-blur-md sm:start-3 sm:top-3">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" />{t('desktop.mock.noAds')}
            </span>
            <div className="absolute inset-x-2.5 bottom-2.5 sm:inset-x-3 sm:bottom-3">
              {film && !compact && <p dir="auto" className="mb-2 truncate font-display text-[clamp(16px,2vw,24px)] font-bold leading-tight text-white">{film.title}</p>}
              <div className="h-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-[38%] rounded-full bg-red-600" />
              </div>
              {!compact && (
                <div aria-hidden className="mt-2 flex items-center gap-3 text-white/80">
                  <Pause className="h-4 w-4 fill-current" />
                  <Volume2 className="h-4 w-4 rtl:-scale-x-100" />
                  <span dir="ltr" className="text-[11px] tabular-nums text-white/60">0:42:17</span>
                  <Maximize className="ms-auto h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* The source bar: the app's own player first. */}
          <div className={cn('flex w-fit max-w-full gap-1 overflow-hidden rounded-full bg-white/[0.06] p-1', compact ? 'mt-2' : 'mt-3')}>
            <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium text-black">
              <Check aria-hidden className="h-3.5 w-3.5 text-emerald-600" />{LOCAL_PLAYER_SOURCE}
            </span>
            {OTHER_SOURCES.map((name) => (
              <span key={name} className="inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[12px] font-medium text-white/50">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {!compact && (
        <span className="glass-strong absolute -bottom-4 end-4 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-medium text-white shadow-[0_18px_40px_-12px_rgb(0_0_0/0.9)] animate-in fade-in slide-in-from-bottom-2 fill-mode-both delay-1000 duration-500 motion-reduce:slide-in-from-bottom-0 sm:end-8">
          <ShieldBan aria-hidden className="h-4 w-4 text-red-500" />{t('desktop.mock.blocked')}
        </span>
      )}
    </div>
  )
}
