import Link from 'next/link'
import { PosterSlider } from '@/src/components/Sliders'
import RamadanCountdown from '@/src/components/ramadan/RamadanCountdown'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale } from '@/src/lib/i18n'
import { arabRamadanSeries, ramadanSeasons, ramadanStatus, tunisianRamadanSeries } from '@/src/lib/ramadan'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return { title: `${t('ramadan.title')} | TunisiaFlicks`, description: t('ramadan.intro') }
}

/** Ramadan hub: countdown / "day N", then each Ramadan's Tunisian and Arab series. */
export default async function RamadanPage() {
  const t = getT()
  const locale = getLocale()
  const kids = await getKidsMode()
  const status = ramadanStatus()
  const seasons = ramadanSeasons().slice(0, 5)
  const latest = seasons[0]

  const [tunisian, arab] = await Promise.all([
    Promise.all(seasons.map((season) => tunisianRamadanSeries(season.year, locale, kids))),
    latest ? arabRamadanSeries(latest.year, locale, kids) : Promise.resolve([]),
  ])
  const formatDate = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const isNow = (year: number) => status?.phase === 'during' && status.year === year

  return (
    <div className="w-full max-w-[1800px] px-4 sm:px-14 space-y-8 pb-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1b1036] via-[#2a1450] to-[#0d0c0f] p-6 text-white md:p-10">
        {/* Crescent and sparkle: emoji, so nothing extra loads. */}
        <span aria-hidden className="pointer-events-none absolute -end-6 -top-10 text-[10rem] leading-none opacity-20 md:text-[14rem]">🌙</span>
        <span aria-hidden className="pointer-events-none absolute end-40 top-6 text-2xl opacity-40">✨</span>
        <div className="relative max-w-2xl space-y-4">
          <p className="w-fit rounded-full bg-amber-400/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#1b1036]">{t('ramadan.badge')}</p>
          <h1 className="text-3xl font-bold md:text-5xl">{status?.phase === 'during' ? t('ramadan.mubarak') : t('ramadan.title')}</h1>
          <p className="text-amber-50/80">{t('ramadan.intro')}</p>
          {status?.phase === 'during' && (
            <p className="text-xl font-semibold text-amber-300">{t('ramadan.day', { day: status.day })}</p>
          )}
          {status?.phase === 'before' && (
            <div className="space-y-3">
              <p className="text-amber-100">{t('ramadan.startsAround', { year: status.year, date: formatDate(status.start) })}</p>
              <RamadanCountdown start={status.start} />
              <p className="text-xs text-amber-100/60">{t('ramadan.moonNote')}</p>
            </div>
          )}
          <Link href="/tunisian?type=series" className="inline-block rounded-md bg-red-500 px-4 py-2 text-sm font-semibold hover:bg-red-400">
            {t('ramadan.streamTunisian')}
          </Link>
        </div>
      </section>

      {latest && (
        <PosterSlider title={isNow(latest.year) ? t('ramadan.arabNow') : t('ramadan.arabOf', { year: latest.year })} items={arab} kind="tv" />
      )}
      {seasons.map((season, index) => (
        <PosterSlider
          key={season.year}
          title={isNow(season.year) ? t('ramadan.tunisianNow') : t('ramadan.tunisianOf', { year: season.year })}
          items={tunisian[index]}
          kind="tv"
        />
      ))}
    </div>
  )
}
