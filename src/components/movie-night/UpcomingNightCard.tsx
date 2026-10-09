// Home slot 5: a grown-up's next movie night within 7 days, as a compact framed card. Mounted in
// src/app/page.tsx inside Suspense; skipped for Kids and in TV mode. Nothing at all otherwise
// (guests, no night coming, a slow database: 4 seconds at most).
import NightCard from '@/src/components/movie-night/NightCard'
import { SectionHeader } from '@/src/components/rows/Row'
import { getT } from '@/src/lib/i18n/server'
import { listMyNights } from '@/src/lib/movie-night'
import { socialSelf } from '@/src/lib/social/session'
import { withTimeout } from '@/src/lib/with-timeout'

export default async function UpcomingNightCard(): Promise<JSX.Element | null> {
  const self = await socialSelf().catch(() => null)
  if (!self || self.kids || self.limited) return null
  const nights = await withTimeout(listMyNights(self.ref, { within: 7 }), 4000, [])
  const next = nights.find((night) => night.status === 'planned' && night.role !== 'requested')
  if (!next) return null
  const t = getT()
  return (
    <section aria-label={t('movieNight.home.title')}>
      <SectionHeader title={t('movieNight.home.title')} href="/movie-night" />
      <div className="page-x">
        <NightCard night={next} href={next.href} className="md:max-w-[720px]" />
      </div>
    </section>
  )
}
