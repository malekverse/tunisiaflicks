import Link from 'next/link'
import { ChevronRight, MoonStar } from 'lucide-react'
import { getT } from '@/src/lib/i18n/server'
import { BANNER_DAYS_BEFORE, ramadanStatus } from '@/src/lib/ramadan'

/** Seasonal home banner: the weeks before Ramadan and during it. Renders nothing otherwise. */
export default function RamadanBanner() {
  const status = ramadanStatus()
  if (status.phase === 'before' && status.daysUntil > BANNER_DAYS_BEFORE) return null
  const t = getT()
  return (
    <div className="page-x">
      <Link
        href="/ramadan"
        className="group pressable relative flex items-center gap-4 overflow-hidden rounded-[22px] bg-gradient-to-r from-amber-500/[0.16] via-amber-300/[0.07] to-transparent px-5 py-4 ring-1 ring-amber-300/20 transition-colors hover:ring-amber-300/40 rtl:bg-gradient-to-l"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-300/15 text-amber-200 shadow-[0_0_30px_rgb(252_211_77/0.25)]">
          <MoonStar aria-hidden className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold text-amber-50">
            {status.phase === 'during' ? t('ramadan.bannerDuring', { day: status.day }) : t('ramadan.bannerBefore', { days: status.daysUntil })}
          </span>
          <span className="block text-sm text-amber-100/70">{t('ramadan.bannerText')}</span>
        </span>
        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-amber-100/60 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
      </Link>
    </div>
  )
}
