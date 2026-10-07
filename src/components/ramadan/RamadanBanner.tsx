import Link from 'next/link'
import { getT } from '@/src/lib/i18n/server'
import { BANNER_DAYS_BEFORE, ramadanStatus } from '@/src/lib/ramadan'

/** Seasonal home banner: the weeks before Ramadan and during it. Renders nothing otherwise. */
export default function RamadanBanner() {
  const status = ramadanStatus()
  if (!status || (status.phase === 'before' && status.daysUntil > BANNER_DAYS_BEFORE)) return null
  const t = getT()
  return (
    <Link
      href="/ramadan"
      className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#1b1036] via-[#2a1450] to-[#3b1d5e] px-5 py-4 text-white transition hover:brightness-110"
    >
      <span aria-hidden className="text-3xl">🌙</span>
      <span className="flex-1">
        <span className="block font-semibold">
          {status.phase === 'during' ? t('ramadan.bannerDuring', { day: status.day }) : t('ramadan.bannerBefore', { days: status.daysUntil })}
        </span>
        <span className="block text-sm text-amber-100/80">{t('ramadan.bannerText')}</span>
      </span>
      <span aria-hidden className="text-2xl rtl:-scale-x-100">→</span>
    </Link>
  )
}
