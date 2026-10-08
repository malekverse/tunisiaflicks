import Link from 'next/link'
import { MoonStar, Play } from 'lucide-react'
import { PosterSlider } from '@/src/components/Sliders'
import RamadanCountdown from '@/src/components/ramadan/RamadanCountdown'
import RoomTint from '@/src/components/shell/RoomTint'
import { Button } from '@/src/components/ui/button'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale } from '@/src/lib/i18n'
import { arabRamadanSeries, ramadanSeasons, ramadanStatus, tunisianRamadanSeries } from '@/src/lib/ramadan'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('ramadan.title'), description: t('ramadan.intro'), path: '/ramadan', card: 'ramadan' })
}

// Lantern gold: during Ramadan the room is lit warm.
const LANTERN = '245 190 80'

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
    new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const isNow = (year: number) => status?.phase === 'during' && status.year === year

  return (
    <div className="space-y-12 pb-10">
      <RoomTint color={LANTERN} />
      <section className="page-x page-top relative isolate overflow-hidden pb-4">
        {/* The crescent, glowing like a lantern behind the title. */}
        <div aria-hidden className="pointer-events-none absolute -end-16 top-6 -z-10 sm:end-4">
          <div className="absolute inset-10 rounded-full bg-amber-300/25 blur-3xl" />
          <MoonStar className="relative h-[260px] w-[260px] text-amber-200/25 sm:h-[380px] sm:w-[380px]" strokeWidth={0.6} />
        </div>
        <div className="max-w-2xl space-y-5">
          <h1 className="animate-focus-in font-display text-[clamp(40px,6.5vw,92px)] font-extrabold leading-[0.92] text-amber-50">
            {status?.phase === 'during' ? t('ramadan.mubarak') : t('ramadan.title')}
          </h1>
          <p className="max-w-[56ch] animate-focus-in text-[15px] leading-relaxed text-amber-50/70 [animation-delay:60ms]">{t('ramadan.intro')}</p>
          {status?.phase === 'during' && (
            <p className="animate-focus-in font-display text-3xl font-bold text-amber-300 [animation-delay:120ms]">{t('ramadan.day', { day: status.day })}</p>
          )}
          {status?.phase === 'before' && (
            <div className="animate-focus-in space-y-3 [animation-delay:120ms]">
              <p className="text-amber-100/90">{t('ramadan.startsAround', { year: status.year, date: formatDate(status.start) })}</p>
              <RamadanCountdown start={status.start} />
              <p className="text-xs text-amber-100/50">{t('ramadan.moonNote')}</p>
            </div>
          )}
          <Button asChild size="lg" className="animate-focus-in [animation-delay:180ms]">
            <Link href="/tunisian?type=series"><Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />{t('ramadan.streamTunisian')}</Link>
          </Button>
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
