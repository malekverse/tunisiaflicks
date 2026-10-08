import { Suspense } from 'react'
import type { Metadata } from 'next'
import BecauseYouWatched from '@/src/components/BecauseYouWatched'
import ContinueWatching from '@/src/components/ContinueWatching'
import PickOfTheDay from '@/src/components/PickOfTheDay'
import RamadanBanner from '@/src/components/ramadan/RamadanBanner'
import { PushPrompt } from '@/src/components/PushSettings'
import { HeroSlider, PosterSlider } from '@/src/components/Sliders'
import Billboard from '@/src/components/home/Billboard'
import ChipRail from '@/src/components/home/ChipRail'
import Top10Row from '@/src/components/home/Top10Row'
import { AnniversaryRow, SeasonRows, SequelRow } from '@/src/components/home/MomentRows'
import getMovies from './(movies)/actions'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'
import { getPickOfTheDay } from '@/src/lib/pick-of-the-day'
import { getCommunityTrending } from '@/src/lib/community'
import { getBillboard } from '@/src/lib/billboard'
import { getTop10 } from '@/src/lib/top10'
import { JsonLd, websiteJsonLd } from '@/src/lib/structured-data'

// TMDB responses are cached for an hour by the data cache (see lib/tmdb.ts); the page itself is
// rendered per request so a TMDB hiccup can never get frozen into a static page.
export const dynamic = 'force-dynamic'

// The site-wide title, description and share card (from the root layout), at its own URL.
export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function MainPage() {
  const kids = await getKidsMode()
  const locale = getLocale()
  const [data, pick, community, billboard] = await Promise.all([
    getMovies(kids),
    getPickOfTheDay(kids, locale),
    getCommunityTrending(kids, locale),
    getBillboard(kids, locale),
  ])
  const top10 = await getTop10(kids, community)
  const t = getT()

  return (
    <div className="pb-6">
      <JsonLd data={websiteJsonLd()} />
      <Billboard items={billboard} />
      {/* On desktop the first rows rise into the billboard's fade. */}
      <div className="relative z-10 mt-6 space-y-10 sm:space-y-12 md:-mt-16">
        <ChipRail />
        {/* Seasonal: only in the weeks before Ramadan and during it. */}
        <RamadanBanner />
        {/* Signed-in users only; renders nothing for guests. */}
        <ContinueWatching />
        <Top10Row top10={top10} />
        {/* Whatever the calendar says is on (Halloween, Eid, summer...): streamed in. */}
        <Suspense fallback={null}><SeasonRows kids={kids} /></Suspense>
        {/* Installed app only: invite to get the pick as a notification. */}
        <PushPrompt />
        <PosterSlider title={t('home.trendingMovies')} href="/discover" items={data.TrendingMovies?.results} />
        <PickOfTheDay pick={pick} />
        <Suspense fallback={null}><SequelRow kids={kids} /></Suspense>
        <BecauseYouWatched />
        {/* What people on the site watched this week, unless it already made the Top 10. */}
        {top10.source !== 'site' && <PosterSlider title={t('home.communityTrending')} items={community} kind="mixed" />}
        <HeroSlider title={t('home.nowPlaying')} items={data.nowPlayingMovies?.results} />
        <PosterSlider title={t('home.popularMovies')} items={data.popularMovies?.results} />
        <PosterSlider title={t('home.topRatedMovies')} href="/top-rated" items={data.topRatedMovies?.results} />
        <Suspense fallback={null}><AnniversaryRow kids={kids} /></Suspense>
        <PosterSlider title={t('home.comingSoon')} href="/upcoming" items={data.upcomingMovies?.results} />
      </div>
    </div>
  )
}
