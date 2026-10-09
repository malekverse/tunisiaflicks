import { ChevronRight } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import { arabCountryHref } from '@/src/lib/arab-countries'
import { sortByName } from '@/src/lib/arab-map'
import { dateLocale, htmlLang, type Locale } from '@/src/lib/i18n/locales'
import type { Translate } from '@/src/lib/i18n/translate'
import { cn } from '@/src/lib/utils'
import CountryLink from './CountryLink'
import type { MapCountry } from '@/src/lib/arab-cinema'

/**
 * Every country as a 60px row, alphabetical in the viewer's language ('ال' set aside): the map's
 * accessible twin (screen readers, the keyboard, a TV remote's D-pad). Each row: the film of the
 * day's poster, the name, the film's title, and the counts (a label and a number each).
 */
export default function CountryList({ countries, kids, locale, t }: {
  countries: MapCountry[]
  kids: boolean
  locale: Locale
  t: Translate
}) {
  const format = new Intl.NumberFormat(dateLocale(locale))
  const sorted = sortByName(countries, htmlLang(locale))
  return (
    <ul className="page-x divide-y divide-white/[0.06]">
      {sorted.map((country) => {
        const dim = kids && country.films !== null && country.n === 0
        const pick = dim ? null : country.pick
        return (
          <li key={country.code}>
            <CountryLink
              href={arabCountryHref(country.code)}
              className="group/row -mx-2 flex h-[60px] items-center gap-3 rounded-[14px] px-2 outline-none transition-colors duration-150 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
            >
              <span
                className={cn(
                  'relative grid h-12 w-8 shrink-0 place-items-center overflow-hidden rounded-[6px]',
                  dim ? 'border border-dashed border-white/25' : 'bg-white/[0.06] ring-1 ring-inset ring-white/[0.08]',
                )}
              >
                {pick?.poster && <TmdbImage kind="poster" path={pick.poster} fill sizes="32px" alt="" className="object-cover" />}
                {!pick?.poster && country.code === 'tn' && <TunisiaMark className="h-5 w-5 text-red-500" />}
              </span>
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-[15px] font-semibold leading-tight text-white">{country.name}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-white/55">
                  {dim ? t('arabMap.kidsNothing') : pick ? <bdi>{pick.title}</bdi> : null}
                </span>
              </span>
              {!dim && country.films !== null && (
                <span className="hidden shrink-0 gap-4 text-end min-[360px]:flex">
                  <Count label={t('arabMap.films')} value={format.format(country.films)} />
                  <Count label={t('arabMap.series')} value={format.format(country.series ?? 0)} />
                </span>
              )}
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 group-hover/row:translate-x-0.5 rtl:rotate-180 rtl:group-hover/row:-translate-x-0.5" />
            </CountryLink>
          </li>
        )
      })}
    </ul>
  )
}

function Count({ label, value }: { label: string, value: string }) {
  return (
    <span className="flex w-[52px] flex-col items-end">
      <span className="text-[14px] font-semibold tabular-nums leading-tight text-white/90">{value}</span>
      <span className="text-[11.5px] leading-tight text-white/50">{label}</span>
    </span>
  )
}
