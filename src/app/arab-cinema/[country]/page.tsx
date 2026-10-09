import { Suspense } from 'react'
import { notFound, permanentRedirect } from 'next/navigation'
import { Baby, CloudOff, Film } from 'lucide-react'
import RoomTint from '@/src/components/shell/RoomTint'
import { EmptyState } from '@/src/components/MediaGrid'
import RetryButton from '@/src/components/dramas/RetryButton'
import { CountryHeader, Neighbours, PanelGrid, PanelRow, PeopleRow, PickCard } from '@/src/components/arab-map/Panel'
import { getCountryCinema, getCountryPeople, type CountryCinema } from '@/src/lib/arab-cinema'
import { ARAB_COUNTRY_CODES, arabCountryName, isArabCountry, type ArabCountryCode } from '@/src/lib/arab-countries'
import { MAP_ACCENT } from '@/src/lib/arab-map'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { htmlLang, type TKey } from '@/src/lib/i18n'
import { pageMetadata, SITE_URL } from '@/src/lib/seo'
import { JsonLd } from '@/src/lib/structured-data'
import { withTimeout } from '@/src/lib/with-timeout'

// Rendered per request (the viewer's language and profile); the data is cached (lib/arab-cinema).
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Only these addresses exist: the 21 country codes (Tunisia has its own page), and their
// uppercase spellings plus 'tn', which redirect. Anything else (/arab-cinema/zz) is a real 404,
// answered by the router before the page starts streaming. Pages stream with a 200 under the
// root loading screen, so the redirects below arrive in the page (a client-side redirect); the
// middleware answers /EG and /tn with a real 308 first (see the shared-file request).
export const dynamicParams = false
export function generateStaticParams() {
  return ARAB_COUNTRY_CODES.flatMap((code) => (code === 'tn' ? ['TN'] : [code, code.toUpperCase()])).map((country) => ({ country }))
}

type Props = { params: { country: string } }

/**
 * The country in the URL, or the way there: Tunisia has its own cinema page, an uppercase code
 * goes to the lowercase one (both permanent), anything that isn't an Arab League member is a 404.
 */
function countryFrom(param: string): ArabCountryCode {
  const lower = param.toLowerCase()
  if (lower === 'tn') permanentRedirect('/tunisian/cinema')
  if (!isArabCountry(lower)) notFound()
  if (lower !== param) permanentRedirect(`/arab-cinema/${lower}`)
  return lower
}

export function generateMetadata({ params }: Props) {
  const code = countryFrom(params.country)
  const t = getT()
  const country = arabCountryName(code, getLocale())
  return pageMetadata({
    title: t('arabMap.meta.country', { country }),
    description: t('arabMap.meta.countryText', { country }),
    path: `/arab-cinema/${code}`,
    // This route's own share card (opengraph-image.tsx).
    card: false,
  })
}

const ROW_TITLES: Record<CountryCinema['rows'][number]['id'], TKey> = {
  new: 'arabMap.row.new',
  favourites: 'arabMap.row.favourites',
  series: 'arabMap.row.series',
  classics: 'arabMap.row.classics',
}

/** People born there: ~50 requests on a cold cache, so they stream in after the rest. */
async function People({ code, name }: { code: ArabCountryCode, name: string }) {
  const t = getT()
  const people = await withTimeout(getCountryPeople(code, getLocale()), 12000, [])
  return <PeopleRow title={t('arabMap.people', { country: name })} people={people} />
}

/** One country: its numbers, today's pick, its rows (or everything, when there is little), its people, its neighbours. */
export default async function CountryPage({ params }: Props) {
  const code = countryFrom(params.country)
  const t = getT()
  const locale = getLocale()
  const kids = await getKidsMode().catch(() => false)
  const name = arabCountryName(code, locale)
  const nameOf = (other: ArabCountryCode) => arabCountryName(other, locale)
  const data = await withTimeout(getCountryCinema(code, locale, kids), 15000, null)

  // TMDB didn't answer: say so, offer to try again (the map and the header stay usable).
  if (!data || data.failed) {
    return (
      <div className="space-y-6">
        <RoomTint color={MAP_ACCENT} />
        <CountryHeader name={name} films={null} series={null} first={null} locale={locale} t={t} />
        <EmptyState
          title={t('arabMap.error.title')}
          icon={<CloudOff aria-hidden className="h-6 w-6" />}
          action={<RetryButton label={t('arabMap.error.retry')} />}
        >
          {t('arabMap.error.text')}
        </EmptyState>
      </div>
    )
  }

  const empty = data.films + data.series === 0
  const header = <CountryHeader name={name} films={data.films} series={data.series} first={data.first} locale={locale} t={t} />

  // Nothing on record (or nothing kid-safe): an honest empty state, and the way to the neighbours.
  if (empty) {
    return (
      <div className="space-y-4">
        <RoomTint color={MAP_ACCENT} />
        {header}
        <EmptyState
          title={t(kids ? 'arabMap.kidsEmpty.title' : 'arabMap.empty.title')}
          icon={kids ? <Baby aria-hidden className="h-6 w-6" /> : <Film aria-hidden className="h-6 w-6" />}
          action={<Neighbours code={code} nameOf={nameOf} t={t} bare />}
        >
          {t(kids ? 'arabMap.kidsEmpty.text' : 'arabMap.empty.text', { country: name })}
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <RoomTint poster={data.pick?.poster} color={data.pick?.poster ? undefined : MAP_ACCENT} />
      {header}
      {data.pick && <PickCard pick={data.pick} locale={locale} t={t} />}

      {data.everything ? (
        <PanelGrid title={t('arabMap.everything')} items={data.everything} />
      ) : (
        data.rows.map((row) => <PanelRow key={row.id} title={t(ROW_TITLES[row.id])} items={row.items} kind={row.kind} />)
      )}

      {/* Not for Kids profiles, like the Tunisian cinema page's stars. */}
      {!kids && (
        <Suspense fallback={null}>
          <People code={code} name={name} />
        </Suspense>
      )}

      <Neighbours code={code} nameOf={nameOf} t={t} />

      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: t('arabMap.meta.country', { country: name }),
        url: `${SITE_URL}/arab-cinema/${code}`,
        inLanguage: htmlLang(locale),
        isPartOf: { '@type': 'WebSite', name: 'TunisiaFlicks', url: SITE_URL },
        about: { '@type': 'Country', name: arabCountryName(code, 'en') },
      }} />
    </div>
  )
}
