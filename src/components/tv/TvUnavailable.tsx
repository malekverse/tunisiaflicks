"use client"
// What TV mode shows instead of the phone-only pages (clips, swipe, friends, movie nights).
import Link from 'next/link'
import { House, MonitorSmartphone } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'

export default function TvUnavailable() {
  const t = useT()
  return (
    <main id="main" role="main" className="page-top page-x flex min-h-dvh items-center justify-center pb-[var(--tv-safe-y)]">
      <div className="relative isolate w-full max-w-[42rem] overflow-hidden rounded-stage bg-white/[0.04] px-[2.5em] py-[2.6em] text-center ring-1 ring-white/[0.08]">
        <span className="mx-auto grid h-[4.2em] w-[4.2em] place-items-center rounded-[22px] bg-white/[0.07] ring-1 ring-inset ring-white/10">
          <MonitorSmartphone aria-hidden className="h-[2em] w-[2em] text-white/85" strokeWidth={1.7} />
        </span>
        <h1 className="mt-6 text-balance font-display text-[clamp(28px,3.4vw,52px)] font-extrabold leading-[1.02] text-white">{t('tvMode.unavailable.title')}</h1>
        <p className="mx-auto mt-3 max-w-[36ch] text-[17px] leading-relaxed text-white/65">{t('tvMode.unavailable.text')}</p>
        <Link
          href="/"
          data-tv-autofocus
          className="mt-8 inline-flex h-[3em] items-center gap-2.5 rounded-full bg-red-600 px-[1.5em] text-[16px] font-semibold text-white outline-none"
        >
          <House aria-hidden className="h-[1.15em] w-[1.15em]" />
          {t('tvMode.unavailable.home')}
        </Link>
      </div>
    </main>
  )
}
