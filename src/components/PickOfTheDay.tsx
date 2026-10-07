import Link from 'next/link'
import { FaPlay, FaStar } from 'react-icons/fa6'
import TmdbImage from '@/src/components/TmdbImage'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale, isArabicScript } from '@/src/lib/i18n'
import type { PickOfTheDay as Pick } from '@/src/lib/pick-of-the-day'

/** Home page banner: today's pick, with its backdrop, logo, tagline and a Watch now button. */
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
  const genres = (data.genres ?? []).slice(0, 2).map((genre: any) => genre.name).join(isArabicScript(locale) ? '، ' : ', ')
  const href = `/${kind}/${data.id}`
  const today = new Date(`${pick.date}T12:00:00Z`).toLocaleDateString(dateLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <section aria-label={t('pick.title')} className="relative isolate overflow-hidden rounded-2xl bg-[#0d0c0f] text-white shadow-2xl shadow-black/40">
      <div className="absolute inset-0 -z-10 overflow-hidden md:start-1/4">
        <TmdbImage
          kind="backdrop"
          path={data.backdrop_path}
          fill
          sizes="(min-width: 768px) 75vw, 100vw"
          preview="w300"
          shimmer={false}
          alt=""
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c0f] via-[#0d0c0f]/60 to-transparent md:bg-gradient-to-r md:rtl:bg-gradient-to-l md:from-[#0d0c0f] md:via-[#0d0c0f]/50" />
      </div>

      <div className="flex min-h-[340px] flex-col justify-end gap-3 p-6 md:min-h-[380px] md:max-w-[55%] md:p-10">
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          {t('pick.title')}
          <span className="font-normal normal-case opacity-90">· {today}</span>
        </p>
        {logo ? (
          <h2>
            <span className="sr-only">{title}</span>
            <span className="relative block h-20 w-60 md:h-24 md:w-72" aria-hidden>
              <TmdbImage kind="logo" path={logo.file_path} fill sizes="288px" shimmer={false} alt="" className="object-contain object-left rtl:object-right" />
            </span>
          </h2>
        ) : (
          <h2 className="text-3xl font-bold md:text-4xl"><bdi>{title}</bdi></h2>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-300">
          {data.vote_average > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-yellow-400"><FaStar />{data.vote_average.toFixed(1)}</span>
          )}
          {[year, length, genres].filter(Boolean).map((part) => (
            <span key={part} className="before:me-2 before:content-['•'] first:before:hidden">{part}</span>
          ))}
        </p>
        {data.tagline && <p className="text-lg italic text-gray-200">“{data.tagline}”</p>}
        <p className="line-clamp-3 text-sm text-gray-300 md:text-base">{data.overview}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href={`${href}#streamSection`} className="inline-flex items-center gap-2 rounded-md bg-red-500 px-5 py-2.5 text-sm font-semibold hover:bg-red-400">
            <FaPlay /> {t('hero.watchNow')}
          </Link>
          <Link href={href} className="inline-flex items-center rounded-md border border-white/70 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">
            {t('pick.moreInfo')}
          </Link>
        </div>
      </div>
    </section>
  )
}
