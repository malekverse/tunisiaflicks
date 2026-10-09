// The "Movie night" tile of the menu sheet's Together pair (the next night, or "Plan a night").
// Null for Kids. `onNavigate` closes the sheet.
"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Popcorn } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { useProfiles } from '@/src/hooks/use-profiles'
import { nightTime } from '@/src/lib/movie-night-format'
import type { NightSummary } from '@/src/lib/movie-night'
import DateTile from './DateTile'
import { whenLabel } from './NightCard'

type State = { status: 'loading' | 'guest' | 'none' | 'kids' } | { status: 'next'; night: NightSummary }

export default function NightTile(props: { onNavigate: () => void }): JSX.Element | null {
  const { t, locale } = useI18n()
  const { active } = useProfiles()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/movie-night?next=1', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.status === 401) return setState({ status: 'guest' })
        if (body?.code === 'kids') return setState({ status: 'kids' })
        setState(response.ok && body?.next ? { status: 'next', night: body.next } : { status: 'none' })
      })
      .catch(() => { if (!cancelled) setState({ status: 'none' }) })
    return () => { cancelled = true }
  }, [])

  if (active?.kids || state.status === 'kids') return null
  const night = state.status === 'next' ? state.night : null

  return (
    <Link
      href={night ? night.href : state.status === 'guest' ? '/movie-night' : '/movie-night/new'}
      onClick={props.onNavigate}
      className="pressable relative flex h-[84px] flex-col justify-between overflow-hidden rounded-[22px] bg-white/[0.05] p-3.5 outline-none ring-1 ring-inset ring-white/[0.07] transition-colors active:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <span className="text-[15px] font-semibold">{t('movieNight.tile.title')}</span>
      <span className="flex min-w-0 items-center gap-2">
        {night ? (
          <>
            <span className="-mb-1 -ms-0.5"><DateTile at={night.starts_at} tz={night.tz} size="sm" /></span>
            <span suppressHydrationWarning className="line-clamp-2 min-w-0 text-[12.5px] leading-tight text-white/60">
              {whenLabel(night.starts_at, night.tz, t, locale)} <span dir="ltr" className="tabular-nums">{nightTime(night.starts_at, night.tz, locale)}</span>
            </span>
          </>
        ) : (
          <>
            <Popcorn aria-hidden className="h-[18px] w-[18px] shrink-0 text-white/70" />
            <span className="line-clamp-2 min-w-0 text-[12.5px] leading-tight text-white/60">{t('movieNight.tile.plan')}</span>
          </>
        )}
      </span>
    </Link>
  )
}
