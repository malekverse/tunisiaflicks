// /movie-night: your nights. Plan one, or decide right now with Swipe; then what's coming up and
// the last two weeks. Guests get an invitation to sign in; Kids profiles don't have nights.
import Link from 'next/link'
import { Plus, Popcorn } from 'lucide-react'
import PageHeader from '@/src/components/browse/PageHeader'
import { EmptyState } from '@/src/components/MediaGrid'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import DecideNowCard from '@/src/components/movie-night/DecideNowCard'
import NightCard from '@/src/components/movie-night/NightCard'
import NightsSignedOut from '@/src/components/movie-night/NightsSignedOut'
import { Button } from '@/src/components/ui/button'
import { getT } from '@/src/lib/i18n/server'
import { listNightsPage } from '@/src/lib/movie-night'
import { pageMetadata } from '@/src/lib/seo'
import { socialSelf } from '@/src/lib/social/session'
import { withTimeout } from '@/src/lib/with-timeout'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('movieNight.title'), description: t('movieNight.metaDescription'), path: '/movie-night', noIndex: true })
}

export default async function MovieNightsPage() {
  const t = getT()
  const self = await socialSelf().catch(() => null)
  if (self?.kids) {
    return <KidsBlocked what="social" title={t('movieNight.kids.title')} description={t('movieNight.kids.text')} next="/movie-night" />
  }
  const signedIn = !!self && !self.limited
  const data = signedIn ? await withTimeout(listNightsPage(self!.ref), 6000, null) : null

  const plan = (
    <Button asChild size="lg">
      <Link href="/movie-night/new"><Plus aria-hidden className="h-5 w-5" strokeWidth={2.2} />{t('movieNight.plan')}</Link>
    </Button>
  )
  const sectionTitle = 'mb-3 font-display text-[21px] font-bold leading-tight text-white sm:mb-4 sm:text-[26px]'

  return (
    <div className="pb-10">
      <PageHeader title={t('movieNight.title')} subtitle={t('movieNight.subtitle')}>
        {signedIn && plan}
      </PageHeader>

      {!signedIn ? (
        <div className="space-y-10 sm:space-y-12">
          <NightsSignedOut />
          <div className="page-x"><DecideNowCard className="max-w-[560px]" /></div>
        </div>
      ) : (
        <div className="page-x grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_360px]">
          <aside className="lg:col-start-2 lg:row-start-1">
            <div className="lg:sticky lg:top-[calc(var(--topbar)+24px)]"><DecideNowCard /></div>
          </aside>

          <div className="min-w-0 max-w-[760px] space-y-10 sm:space-y-12 lg:col-start-1 lg:row-start-1">
            {!data ? (
              <EmptyState
                icon={<Popcorn aria-hidden className="h-6 w-6" />}
                title={t('movieNight.loadFailed')}
                action={<Button asChild variant="secondary"><Link href="/movie-night">{t('movieNight.retry')}</Link></Button>}
              />
            ) : data.upcoming.length === 0 && data.past.length === 0 ? (
              <div className="rounded-[22px] bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]">
                <EmptyState icon={<Popcorn aria-hidden className="h-6 w-6" />} title={t('movieNight.empty.title')} action={plan}>
                  {t('movieNight.empty.text')}
                </EmptyState>
              </div>
            ) : (
              <>
                {data.upcoming.length > 0 && (
                  <section aria-labelledby="nights-upcoming">
                    <h2 id="nights-upcoming" className={sectionTitle}>{t('movieNight.upcoming')}</h2>
                    <ul className="space-y-3">
                      {data.upcoming.map((night) => <li key={night.id}><NightCard night={night} href={night.href} /></li>)}
                    </ul>
                  </section>
                )}
                {data.past.length > 0 && (
                  <section aria-labelledby="nights-past">
                    <h2 id="nights-past" className={sectionTitle}>{t('movieNight.past')}</h2>
                    <ul className="space-y-3">
                      {data.past.map((night) => <li key={night.id}><NightCard night={night} href={night.href} className="bg-white/[0.025]" /></li>)}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
