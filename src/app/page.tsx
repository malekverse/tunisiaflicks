import BecauseYouWatched from '@/src/components/BecauseYouWatched'
import ContinueWatching from '@/src/components/ContinueWatching'
import Genres from '@/src/components/Genres'
import MoodChips from '@/src/components/MoodChips'
import { HeroSlider, PosterSlider } from '@/src/components/Sliders'
import getMovies from './(movies)/actions'
import { getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'

// TMDB responses are cached for an hour by the data cache (see lib/tmdb.ts); the page itself is
// rendered per request so a TMDB hiccup can never get frozen into a static page.
export const dynamic = 'force-dynamic'

export default async function MainPage() {
  const data = await getMovies(await getKidsMode())
  const t = getT()

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-14 space-y-6'>
      <Genres />
      <MoodChips />
      {/* Signed-in users only; both render nothing for guests. */}
      <ContinueWatching />
      <BecauseYouWatched />
      <HeroSlider title={t('home.trendingMovies')} href='/discover' items={data.TrendingMovies?.results} />
      <PosterSlider title={t('home.popularMovies')} items={data.popularMovies?.results} />
      <PosterSlider title={t('home.topRatedMovies')} href='/top-rated' items={data.topRatedMovies?.results} />
      <PosterSlider title={t('home.nowPlaying')} items={data.nowPlayingMovies?.results} />
      <PosterSlider title={t('home.comingSoon')} href='/upcoming' items={data.upcomingMovies?.results} />
    </div>
  )
}
