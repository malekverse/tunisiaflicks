import { Suspense } from 'react'
import Link from 'next/link'
import { PosterSlider } from '@/src/components/Sliders'
import TmdbImage from '@/src/components/TmdbImage'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getTunisianCinema, getTunisianStars } from '@/src/lib/tunisian-cinema'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return { title: `${t('tnCinema.title')} | TunisiaFlicks`, description: t('tnCinema.intro') }
}

async function Stars() {
  const t = getT()
  const stars = await getTunisianStars(getLocale())
  if (stars.length === 0) return null
  return (
    <section aria-label={t('tnCinema.stars')}>
      <h2 className="mb-3 text-2xl font-semibold sm:text-3xl">{t('tnCinema.stars')}</h2>
      <div className="flex gap-5 overflow-x-auto pb-3 no-scrollbar">
        {stars.map((star) => (
          <Link key={star.id} href={`/person/${star.id}`} className="group w-28 shrink-0 text-center">
            <span className="relative mx-auto block h-28 w-28 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-transparent transition group-hover:ring-red-500">
              <TmdbImage kind="profile" path={star.profile_path} fill sizes="112px" alt={star.name} className="object-cover" style={{ objectPosition: '0 25%' }} />
            </span>
            <bdi className="mt-2 block truncate text-sm font-medium">{star.name}</bdi>
            <span className="block truncate text-xs text-gray-500"><bdi>{star.knownFor}</bdi></span>
          </Link>
        ))}
      </div>
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
    <div className="w-full max-w-[1800px] px-4 sm:px-14 space-y-8 pb-8">
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#0d0c0f] text-white">
        {featured && (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <TmdbImage kind="backdrop" path={featured.backdrop_path} fill sizes="100vw" preview="w300" shimmer={false} alt="" className="object-cover opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c0f] via-[#0d0c0f]/70 to-transparent" />
          </div>
        )}
        <div className="flex min-h-[260px] flex-col justify-end gap-3 p-6 md:p-10">
          <p className="w-fit rounded-full bg-red-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide">🇹🇳 {t('tnCinema.badge')}</p>
          <h1 className="text-3xl font-bold md:text-5xl">{t('tnCinema.title')}</h1>
          <p className="max-w-2xl text-gray-300">{t('tnCinema.intro')}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/tunisian" className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold hover:bg-red-400">{t('tnCinema.catalogue')}</Link>
            {featured && (
              <Link href={`/movie/${featured.id}`} className="rounded-md border border-white/70 px-4 py-2 text-sm font-semibold hover:bg-white/10">
                {t('tnCinema.featured', { title: featured.title })}
              </Link>
            )}
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
