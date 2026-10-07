import Genres from '@/src/components/Genres'
import { HeroSlider, PosterSlider } from '@/src/components/Sliders'
import getTVShows from './actions'
import { getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'

export const dynamic = 'force-dynamic'

export default async function TVPage() {
  const data = await getTVShows(await getKidsMode())
  const t = getT()

  return (
    <div className='w-full max-w-[1800px] px-4 sm:px-14 space-y-6'>
      <Genres type="tv" />
      <h1 className='text-3xl sm:text-4xl font-bold'>{t('tvPage.title')}</h1>
      <HeroSlider title={t('tvPage.trending')} href='/discover?type=tv' kind='tv' items={data.trendingTVShows?.results} />
      <PosterSlider title={t('tvPage.popular')} kind='tv' items={data.popularTVShows?.results} />
      <PosterSlider title={t('tvPage.topRated')} kind='tv' items={data.topRatedTVShows?.results} />
      <PosterSlider title={t('tvPage.onTheAir')} kind='tv' items={data.onTheAirTVShows?.results} />
      <PosterSlider title={t('tvPage.airingToday')} kind='tv' items={data.airingTodayTVShows?.results} />
    </div>
  )
}
