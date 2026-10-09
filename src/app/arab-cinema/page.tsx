import { CloudOff } from 'lucide-react'
import RoomTint from '@/src/components/shell/RoomTint'
import { SectionHeader } from '@/src/components/rows/Row'
import RetryButton from '@/src/components/dramas/RetryButton'
import CountryList from '@/src/components/arab-map/CountryList'
import { PanelRow } from '@/src/components/arab-map/Panel'
import { getArabMapIndex } from '@/src/lib/arab-cinema'
import { MAP_ACCENT, rippleDistance } from '@/src/lib/arab-map'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { htmlLang } from '@/src/lib/i18n/locales'
import { pageMetadata, SITE_URL } from '@/src/lib/seo'
import { JsonLd } from '@/src/lib/structured-data'

export const maxDuration = 30

export function generateMetadata() {
  const t = getT()
  // The share card is this route's own (opengraph-image.tsx).
  return pageMetadata({ title: t('arabMap.title'), description: t('arabMap.intro'), path: '/arab-cinema', card: false })
}

/**
 * The map's index panel: the title, every country in a list (the map's accessible twin), today's
 * film from each country, and where the numbers come from.
 */
export default async function ArabCinemaPage() {
  const t = getT()
  const locale = getLocale()
  const kids = await getKidsMode().catch(() => false)
  const index = await getArabMapIndex(locale, kids)

  // Each country's film of the day, rippling out from Tunisia like the map's entrance.
  const today = index.countries
    .filter((country) => country.pick?.poster)
    .sort((a, b) => rippleDistance(a.code) - rippleDistance(b.code))
    .map((country) => ({
      id: country.pick!.id,
      media_type: country.pick!.kind,
      title: country.pick!.title,
      name: country.pick!.title,
      poster_path: country.pick!.poster,
      backdrop_path: country.pick!.backdrop,
      release_date: country.pick!.year ? `${country.pick!.year}-01-01` : undefined,
      country: country.name,
    }))

  return (
    <div className="space-y-10 pt-1 xl:pt-8">
      <RoomTint color={MAP_ACCENT} />
      <div className="page-x">
        <h1 className="font-display text-[clamp(40px,5.2vw,68px)] font-extrabold leading-[0.95] text-white">{t('arabMap.title')}</h1>
        <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-white/70">{t('arabMap.intro')}</p>
      </div>

      <section aria-label={t('arabMap.all')}>
        <SectionHeader title={t('arabMap.all')} />
        <CountryList countries={index.countries} kids={kids} locale={locale} t={t} />
      </section>

      {index.namesOnly ? (
        <div className="page-x">
          <div className="flex flex-col items-start gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:flex-row sm:items-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/60">
              <CloudOff aria-hidden className="h-5 w-5" />
            </span>
            <p className="flex-1 text-[14px] leading-snug text-white/70">{t('arabMap.namesOnly')}</p>
            <RetryButton label={t('arabMap.error.retry')} />
          </div>
        </div>
      ) : (
        <PanelRow
          title={t('arabMap.today')}
          subtitle={t('arabMap.todaySubtitle')}
          items={today}
          kind="movie"
          overlay={(item) => (
            <span className="glass absolute bottom-2 start-2 max-w-[calc(100%-16px)] truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-white/90">
              {item.country}
            </span>
          )}
        />
      )}

      <p className="page-x max-w-[64ch] text-[12.5px] leading-relaxed text-white/50">{t('arabMap.source')}</p>

      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: t('arabMap.title'),
        description: t('arabMap.intro'),
        url: `${SITE_URL}/arab-cinema`,
        inLanguage: htmlLang(locale),
        isPartOf: { '@type': 'WebSite', name: 'TunisiaFlicks', url: SITE_URL },
      }} />
    </div>
  )
}
