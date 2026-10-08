import { HeroSlider, PosterSlider } from '@/src/components/Sliders'
import Billboard from '@/src/components/home/Billboard'
import ChipRail from '@/src/components/home/ChipRail'
import getTVShows from './actions'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'
import { getBillboard } from '@/src/lib/billboard'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('tvPage.title'), description: t('tvPage.description'), path: '/tv', card: 'tv' })
}

export default async function TVPage() {
  const kids = await getKidsMode()
  const [data, billboard] = await Promise.all([getTVShows(kids), getBillboard(kids, getLocale(), 'tv')])
  const t = getT()

  return (
    <div className="pb-6">
      <h1 className="sr-only">{t('tvPage.title')}</h1>
      <Billboard items={billboard} />
      <div className="relative z-10 mt-6 space-y-10 sm:space-y-12 md:-mt-16">
        <ChipRail type="tv" />
        <PosterSlider title={t('tvPage.trending')} href="/discover?type=tv" kind="tv" items={data.trendingTVShows?.results} />
        <HeroSlider title={t('tvPage.onTheAir')} kind="tv" items={data.onTheAirTVShows?.results} />
        <PosterSlider title={t('tvPage.popular')} kind="tv" items={data.popularTVShows?.results} />
        <PosterSlider title={t('tvPage.topRated')} href="/top-rated?type=tv" kind="tv" items={data.topRatedTVShows?.results} />
        <PosterSlider title={t('tvPage.airingToday')} kind="tv" items={data.airingTodayTVShows?.results} />
      </div>
    </div>
  )
}
