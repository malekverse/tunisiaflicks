import Link from 'next/link'
import { Info, Play, Star } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale } from '@/src/lib/i18n'
import type { PickOfTheDay as Pick } from '@/src/lib/pick-of-the-day'

/**
 * Home page: today's pick, as a wide frame. The date is the headline (it changes every day; that
 * is the point), then the title, its tagline and two actions.
 */
export default function PickOfTheDay({ pick }: { pick: Pick | null }) {
  if (!pick) return null
  const t = getT()
  const locale = getLocale()
  const { kind, data } = pick

  const title: string = data.title || data.name || ''
  const logos: any[] = data.images?.logos ?? []
  const logo = logos.find((item) => item.iso_639_1 === 'en') ?? logos[0]
  const year = (data.release_date || data.first_air_date || '').slice(0, 4)
  const length = kind === 'movie'
    ? data.runtime ? t('pick.runtime', { hours: Math.floor(data.runtime / 60), minutes: data.runtime % 60 }) : ''
    : data.number_of_seasons > 1 ? t('pick.seasons', { count: data.number_of_seasons }) : data.number_of_seasons === 1 ? t('pick.oneSeason') : ''
  const genres = (data.genres ?? []).slice(0, 2).map((genre: any) => genre.name)
  const href = `/${kind}/${data.id}`
  const play = kind === 'tv' ? `/tv/${data.id}?s=1&e=1` : `${href}#streamSection`
  const day = new Date(`${pick.date}T12:00:00Z`)
  const weekday = day.toLocaleDateString(dateLocale(locale), { weekday: 'long', timeZone: 'UTC' })
  const date = day.toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <section aria-label={t('pick.title')} className="page-x">
      <div className="relative isolate overflow-hidden rounded-[24px] bg-white/[0.03] ring-1 ring-white/[0.07] sm:rounded-stage">
        {/* Phones: the picture is a band on top and the text sits under it. Desktop: the picture
            fills the end side and the text lies over its fade. */}
        <div className="relative -z-10 aspect-[16/10] overflow-hidden md:absolute md:inset-0 md:start-[30%] md:aspect-auto">
          <TmdbImage
            kind="backdrop"
            path={data.backdrop_path}
            fill
            sizes="(min-width: 768px) 70vw, 100vw"
            preview="w300"
            shimmer={false}
            alt=""
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent md:bg-gradient-to-r md:from-black md:via-black/60 md:to-transparent md:rtl:bg-gradient-to-l" />
        </div>

        <div className="-mt-20 flex flex-col justify-end gap-4 p-6 sm:p-8 md:mt-0 md:min-h-[440px] md:max-w-[56%] md:justify-center md:p-12">
          <div>
            <p className="text-[13px] font-medium text-white/60">{t('pick.title')}</p>
            <p className="mt-1 font-display text-[clamp(30px,4vw,52px)] font-extrabold leading-[0.95] text-white">
              {weekday}
              <span className="block text-white/45">{date}</span>
            </p>
          </div>
          {logo ? (
            <h2 className="mt-2">
              <span className="sr-only">{title}</span>
              <span className="relative block h-16 w-56 md:h-20 md:w-72" aria-hidden>
                <TmdbImage kind="logo" path={logo.file_path} fill sizes="288px" shimmer={false} alt="" className="object-contain object-left rtl:object-right" />
              </span>
            </h2>
          ) : (
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl"><bdi>{title}</bdi></h2>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
            {data.vote_average > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-white"><Star aria-hidden className="h-3.5 w-3.5 fill-star text-star" />{data.vote_average.toFixed(1)}</span>
            )}
            {year && <span>{year}</span>}
            {length && <span>{length}</span>}
            {genres.length > 0 && <span className="text-white/55">{genres.join(' / ')}</span>}
          </p>
          {data.tagline && <p className="text-pretty text-lg leading-snug text-white/90 md:text-xl">“{data.tagline}”</p>}
          <p className="line-clamp-3 max-w-[60ch] text-sm leading-relaxed text-white/65 md:text-[15px]">{data.overview}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={play}><Play aria-hidden className="h-5 w-5 fill-current" />{t('billboard.play')}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={href}><Info aria-hidden className="h-5 w-5" />{t('pick.moreInfo')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
