"use client"
import { useI18n } from '@/src/components/I18nProvider'
import { dateLocale } from '@/src/lib/i18n/locales'
import { cn } from '@/src/lib/utils'
import type { MapCountry } from '@/src/lib/arab-cinema'

/** A count in the viewer's language (Latin digits in Arabic too, like the rest of the site). */
export function useCount() {
  const { locale } = useI18n()
  const format = new Intl.NumberFormat(dateLocale(locale))
  return (value: number) => format.format(value)
}

/**
 * Films and Series of a country, each a label and a number side by side (never a counted
 * sentence), or the Kids note when nothing is kid-safe. Nothing when the counts are unknown.
 */
export default function MapStats({ country, dim, className }: { country: MapCountry, dim: boolean, className?: string }) {
  const { t } = useI18n()
  const count = useCount()
  if (dim) return <p className={cn('text-[12.5px] text-white/60', className)}>{t('arabMap.kidsNothing')}</p>
  if (country.films === null && country.series === null) return null
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[12.5px]', className)}>
      {country.films !== null && (
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-white/55">{t('arabMap.films')}</span>
          <span className="font-semibold tabular-nums text-white/90">{count(country.films)}</span>
        </span>
      )}
      {country.series !== null && (
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-white/55">{t('arabMap.series')}</span>
          <span className="font-semibold tabular-nums text-white/90">{count(country.series)}</span>
        </span>
      )}
    </p>
  )
}
