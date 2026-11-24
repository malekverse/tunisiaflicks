"use client"
// The sleep timer's parts in the player (hooks/use-sleep-timer): the button and its menu under the
// player, the dimming and the "stopping in…" note over it in the last minute, and the screen that
// replaces the player once it has stopped.
import React from 'react'
import { Check, Moon, MoonStar, Play, TimerOff } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import { useDir, useT } from '@/src/components/I18nProvider'
import type { SleepState } from '@/src/hooks/use-sleep-timer'
import { clock, dimFor, SLEEP_MINUTES, WARN_MS } from '@/src/lib/sleep-timer'
import { cn } from '@/src/lib/utils'

export function SleepButton({ sleep, kind }: { sleep: SleepState, kind: 'movie' | 'tv' }) {
  const t = useT()
  const dir = useDir()
  const on = !!sleep.timer
  const item = 'min-h-10 gap-3 text-[14px]'
  return (
    <DropdownMenu dir={dir}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-9" aria-label={on ? t('sleep.on', { time: clock(sleep.remaining) }) : undefined}>
          <Moon aria-hidden className={cn('h-4 w-4', on && 'fill-current text-amber-200')} />
          {on ? <span dir="ltr" className="tabular-nums">{clock(sleep.remaining)}</span> : t('sleep.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel className="text-[12.5px] font-medium text-white/55">{t('sleep.title')}</DropdownMenuLabel>
        {SLEEP_MINUTES.map((minutes) => (
          <DropdownMenuItem key={minutes} className={item} onSelect={() => sleep.setMinutes(minutes)}>
            <span aria-hidden className="w-4" />
            {t('sleep.minutes', { count: minutes })}
          </DropdownMenuItem>
        ))}
        {sleep.setEpisode && (
          <DropdownMenuItem className={item} onSelect={() => sleep.setEpisode?.()}>
            <span className="w-4">{sleep.timer?.kind === 'episode' ? <Check aria-hidden className="h-4 w-4" /> : null}</span>
            {t(kind === 'tv' ? 'sleep.endEpisode' : 'sleep.endFilm')}
          </DropdownMenuItem>
        )}
        {on && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={item} onSelect={sleep.cancel}>
              <TimerOff aria-hidden className="h-4 w-4 text-white/70" />{t('sleep.off')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Over the player in the last minute: the picture dims, and a note offers more time. */
export function SleepDim({ sleep }: { sleep: SleepState }) {
  const t = useT()
  if (!sleep.timer || sleep.remaining >= WARN_MS) return null
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-1000" style={{ opacity: dimFor(sleep.remaining) }} />
      <div role="status" className="glass-strong absolute bottom-[6%] start-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pe-1.5 ps-4 text-[14px] text-white rtl:translate-x-1/2">
        <MoonStar aria-hidden className="h-4 w-4 text-amber-200" />
        <span>{t('sleep.stopping')} <span dir="ltr" className="tabular-nums">{clock(sleep.remaining)}</span></span>
        <button type="button" onClick={sleep.more} className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-black outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          {t('sleep.more')}
        </button>
        <button type="button" onClick={sleep.cancel} className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/80 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-red-500">
          {t('sleep.keep')}
        </button>
      </div>
    </>
  )
}

/** In the player's place once it has stopped. */
export function SleepScreen({ onWake }: { onWake: () => void }) {
  const t = useT()
  return (
    <div className="absolute inset-0 grid place-items-center bg-black px-6 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
          <MoonStar aria-hidden className="h-7 w-7 text-amber-200" />
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold text-white">{t('sleep.stoppedTitle')}</h3>
        <p className="mt-1 text-sm text-white/60">{t('sleep.stoppedText')}</p>
        <Button className="mt-5" onClick={onWake}><Play aria-hidden className="h-4 w-4 fill-current rtl:-scale-x-100" />{t('sleep.wake')}</Button>
      </div>
    </div>
  )
}
