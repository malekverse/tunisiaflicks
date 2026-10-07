import BecauseYouWatched from '@/src/components/BecauseYouWatched'
import ContinueWatching from '@/src/components/ContinueWatching'
import Genres from '@/src/components/Genres'
import { HeroSlider, PosterSlider } from '@/src/components/Sliders'
import getMovies from './(movies)/actions'

// TMDB responses are cached for an hour by the data cache (see lib/tmdb.ts); the page itself is
// rendered per request so a TMDB hiccup can never get frozen into a static page.
export const dynamic = 'force-dynamic'

export default async function MainPage() {
  const data = await getMovies()

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-14 space-y-6'>
      <Genres />
      {/* Signed-in users only; both render nothing for guests. */}
      <ContinueWatching />
      <BecauseYouWatched />
      <HeroSlider title='Trending Movies' href='/discover' items={data.TrendingMovies?.results} />
      <PosterSlider title='Popular Movies' items={data.popularMovies?.results} />
      <PosterSlider title='Top Rated Movies' href='/top-rated' items={data.topRatedMovies?.results} />
      <PosterSlider title='Now Playing' items={data.nowPlayingMovies?.results} />
      <PosterSlider title='Coming Soon' href='/upcoming' items={data.upcomingMovies?.results} />
    </div>
  )
}
