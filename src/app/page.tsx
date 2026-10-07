import BecauseYouWatched from '@/src/components/BecauseYouWatched'
import ContinueWatching from '@/src/components/ContinueWatching'
import Genres from '@/src/components/Genres'
import MoodChips from '@/src/components/MoodChips'
import PickOfTheDay from '@/src/components/PickOfTheDay'
import { PushPrompt } from '@/src/components/PushSettings'
import { HeroSlider, PosterSlider } from '@/src/components/Sliders'
import getMovies from './(movies)/actions'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'
import { getPickOfTheDay } from '@/src/lib/pick-of-the-day'
import { getCommunityTrending } from '@/src/lib/community'

// TMDB responses are cached for an hour by the data cache (see lib/tmdb.ts); the page itself is
// rendered per request so a TMDB hiccup can never get frozen into a static page.
export const dynamic = 'force-dynamic'

export default async function MainPage() {
  const kids = await getKidsMode()
  const locale = getLocale()
  const [data, pick, community] = await Promise.all([
    getMovies(kids),
    getPickOfTheDay(kids, locale),
    getCommunityTrending(kids, locale),
  ])
  const t = getT()

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-14 space-y-6'>
      <Genres />
      <MoodChips />
      <PickOfTheDay pick={pick} />
      {/* Installed app only: invite to get the pick as a notification. */}
      <PushPrompt />
      {/* Signed-in users only; both render nothing for guests. */}
      <ContinueWatching />
      <BecauseYouWatched />
      {/* What people on the site watched this week (hidden until there's enough activity). */}
      <PosterSlider title={t('home.communityTrending')} items={community} kind='mixed' />
      <HeroSlider title={t('home.trendingMovies')} href='/discover' items={data.TrendingMovies?.results} />
      <PosterSlider title={t('home.popularMovies')} items={data.popularMovies?.results} />
      <PosterSlider title={t('home.topRatedMovies')} href='/top-rated' items={data.topRatedMovies?.results} />
      <PosterSlider title={t('home.nowPlaying')} items={data.nowPlayingMovies?.results} />
      <PosterSlider title={t('home.comingSoon')} href='/upcoming' items={data.upcomingMovies?.results} />
    </div>
  )
}
