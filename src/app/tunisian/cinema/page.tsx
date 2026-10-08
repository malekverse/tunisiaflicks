import { Suspense } from 'react'
import Link from 'next/link'
import { Clapperboard, Info } from 'lucide-react'
import { PosterSlider } from '@/src/components/Sliders'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import TmdbImage from '@/src/components/TmdbImage'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import RoomTint from '@/src/components/shell/RoomTint'
import { Button } from '@/src/components/ui/button'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getTunisianCinema, getTunisianStars } from '@/src/lib/tunisian-cinema'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('tnCinema.title'), description: t('tnCinema.intro'), path: '/tunisian/cinema', card: 'cinema' })
}

async function Stars() {
  const t = getT()
  const stars = await getTunisianStars(getLocale())
  if (stars.length === 0) return null
  return (
    <section aria-label={t('tnCinema.stars')}>
      <SectionHeader title={t('tnCinema.stars')} />
      <Row itemClassName="w-[104px] sm:w-[124px]" gap="gap-3 sm:gap-5">
        {stars.map((star) => (
          <Link key={star.id} href={`/person/${star.id}`} className="group/person block text-center outline-none">
            <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 ease-out group-hover/person:-translate-y-1 group-hover/person:ring-white/40 group-focus-visible/person:ring-2 group-focus-visible/person:ring-red-500">
              <TmdbImage kind="profile" path={star.profile_path} fill sizes="124px" alt={star.name} className="object-cover object-[50%_25%]" />
            </span>
            <bdi className="mt-2.5 block truncate text-[13px] font-medium text-white/90">{star.name}</bdi>
            <span className="block truncate text-[12px] text-white/45"><bdi>{star.knownFor}</bdi></span>
          </Link>
        ))}
      </Row>
    </section>
  )
}

/** Tunisian cinema spotlight (TMDB): new films, most loved, classics, series and the stars. */
export default async function TunisianCinemaPage() {
  const t = getT()
  const kids = await getKidsMode()
  const data = await getTunisianCinema(getLocale(), kids)
  const featured = data.featured

  return (
    <div className="space-y-12 pb-10">
      <RoomTint poster={featured?.poster_path} color={featured?.poster_path ? undefined : '231 0 19'} />
      <section className="relative isolate">
        <div className="relative aspect-[5/4] w-full overflow-hidden sm:aspect-video md:absolute md:inset-0 md:aspect-auto">
          {featured && (
            <TmdbImage kind="backdrop" path={featured.backdrop_path} fill sizes="100vw" preview="w300" shimmer={false} priority alt="" className="animate-ken-burns object-cover object-top" />
          )}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div aria-hidden className="absolute inset-y-0 start-0 hidden w-[70%] bg-gradient-to-r from-black/90 via-black/40 to-transparent md:block rtl:bg-gradient-to-l" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
        </div>
        <div className="page-x relative -mt-28 sm:-mt-36 md:mt-0 md:flex md:min-h-[min(80svh,820px)] md:flex-col md:justify-end md:pb-[clamp(48px,8vh,96px)] md:pt-[calc(var(--topbar)+48px)]">
          <div className="max-w-[640px] space-y-4">
            <TunisiaMark className="h-14 w-14 animate-focus-in text-red-500 drop-shadow-[0_0_24px_rgb(255_36_20/0.6)]" />
            <h1 className="animate-focus-in font-display text-[clamp(40px,6.5vw,92px)] font-extrabold leading-[0.92] [animation-delay:60ms]">{t('tnCinema.title')}</h1>
            <p className="max-w-[56ch] animate-focus-in text-[15px] leading-relaxed text-white/70 [animation-delay:120ms]">{t('tnCinema.intro')}</p>
            <div className="flex animate-focus-in flex-wrap gap-3 pt-2 [animation-delay:180ms]">
              <Button asChild size="lg">
                <Link href="/tunisian"><Clapperboard aria-hidden className="h-5 w-5" />{t('tnCinema.catalogue')}</Link>
              </Button>
              {featured && (
                <Button asChild size="lg" variant="secondary">
                  <Link href={`/movie/${featured.id}`}><Info aria-hidden className="h-5 w-5" /><span className="max-w-[240px] truncate">{t('tnCinema.featured', { title: featured.title })}</span></Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <PosterSlider title={t('tnCinema.recent')} items={data.recent} kind="movie" />
      <PosterSlider title={t('tnCinema.loved')} items={data.loved} kind="movie" />

      {/* Streamed: slow on a cold cache, and not shown to Kids profiles. */}
      {!kids && <Suspense fallback={null}><Stars /></Suspense>}

      <PosterSlider title={t('tnCinema.classics')} items={data.classics} kind="movie" />
      <PosterSlider title={t('tnCinema.series')} items={data.series} kind="tv" />
    </div>
  )
}
