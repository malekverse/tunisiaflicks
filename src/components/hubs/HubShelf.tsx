// Home slot 12, "Beyond Hollywood": one landscape picture door per hub (Tunisian, Tunisian TV,
// Turkish and Korean dramas, Arab cinema). Null for Kids. Mounted in src/app/page.tsx inside
// Suspense; its data is bounded (4s), and each picture is one cached request.
import HubTile from '@/src/components/hubs/HubTile'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { LANDSCAPE_WIDTH } from '@/src/components/dramas/widths'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { tunisDate } from '@/src/lib/hijri'
import { hash } from '@/src/lib/seed'
import { withTimeout } from '@/src/lib/with-timeout'
import { ARAB_TMDB_COUNTRIES } from '@/src/lib/arab-countries'
import { hubPicture } from '@/src/lib/dramas'
import { HUBS, hubPath } from '@/src/lib/dramas-config'
import type { Locale } from '@/src/lib/i18n'

const DAY = 86400
const TUNISIAN_RED = '231 0 19'
const ARAB_SAND = '200 162 122'

/**
 * The Tunisian door's picture: the backdrop of the most popular Tunisian film. Exactly the
 * `popular` request of lib/tunisian-cinema.ts (same parameters, same order, same lifetime), so the
 * two share one cache entry.
 */
async function tunisianPicture(locale: Locale): Promise<string | null> {
  const data = await tmdbFetchSafe<{ results: any[] }>('discover/movie', { with_origin_country: 'TN', language: tmdbLanguage(locale), page: 1, sort_by: 'popularity.desc' }, DAY)
  return (data?.results ?? []).find((item) => item.poster_path && item.backdrop_path)?.backdrop_path ?? null
}

/** Arab cinema's daily pick: one of the most popular films from the 22 Arab League countries. */
async function arabPick(locale: Locale): Promise<{ title: string, backdrop: string } | null> {
  const data = await tmdbFetchSafe<{ results: any[] }>('discover/movie', {
    with_origin_country: ARAB_TMDB_COUNTRIES.join('|'),
    sort_by: 'popularity.desc',
    'vote_count.gte': 20,
    include_adult: false,
    language: tmdbLanguage(locale),
  }, DAY)
  const usable = (data?.results ?? []).filter((item) => item.backdrop_path && item.title).slice(0, 12)
  if (usable.length === 0) return null
  const pick = usable[hash(`${tunisDate()}:arab-cinema:door`) % usable.length]
  return { title: pick.title, backdrop: pick.backdrop_path }
}

/**
 * Tunisian TV has no picture of its own yet: the flag's red with the crescent and star, drawn as an
 * SVG (the tunisian-tv track gives it a channel's picture and a live dot).
 */
const TUNISIAN_TV_PICTURE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><defs><radialGradient id="g" cx="78%" cy="30%" r="85%"><stop offset="0" stop-color="#b3000f"/><stop offset=".55" stop-color="#4a0006"/><stop offset="1" stop-color="#120002"/></radialGradient><mask id="m"><rect width="160" height="90" fill="#fff"/><circle cx="121" cy="34" r="15.5" fill="#000"/></mask></defs><rect width="160" height="90" fill="url(#g)"/><circle cx="115" cy="34" r="19.5" fill="#fff" fill-opacity=".9" mask="url(#m)"/><polygon fill="#fff" fill-opacity=".9" points="114.2,34 120.7,31.9 120.7,25.1 124.7,30.6 131.2,28.5 127.2,34 131.2,39.5 124.7,37.4 120.7,42.9 120.7,36.1"/></svg>',
)}`

export default async function HubShelf({ kids }: { kids: boolean }): Promise<JSX.Element | null> {
  if (kids) return null
  const t = getT()
  const locale = getLocale()
  const pictures = await withTimeout(
    Promise.all([tunisianPicture(locale), hubPicture('turkish'), hubPicture('korean'), arabPick(locale)]),
    4000,
    null,
  )
  const [tunisian, turkish, korean, arab] = pictures ?? [null, null, null, null]
  const backdrop = (path: string | null) => (path ? { kind: 'tmdb-backdrop' as const, src: path } : null)

  const doors = [
    { key: 'tunisian', href: '/tunisian', title: t('dramas.shelf.tunisian'), line: t('dramas.shelf.tunisianLine'), picture: backdrop(tunisian), accent: TUNISIAN_RED },
    { key: 'tunisian-tv', href: '/tunisian/tv', title: t('dramas.shelf.tunisianTv'), line: t('dramas.shelf.tunisianTvLine'), picture: { kind: 'url' as const, src: TUNISIAN_TV_PICTURE }, accent: TUNISIAN_RED },
    { key: 'turkish', href: hubPath('turkish'), title: t('dramas.turkish.title'), line: t('dramas.turkish.line'), picture: backdrop(turkish), accent: HUBS.turkish.accent },
    { key: 'korean', href: hubPath('korean'), title: t('dramas.korean.title'), line: t('dramas.korean.line'), picture: backdrop(korean), accent: HUBS.korean.accent },
    { key: 'arab', href: '/arab-cinema', title: t('dramas.shelf.arab'), line: arab ? t('dramas.shelf.arabLine', { title: arab.title }) : undefined, picture: backdrop(arab?.backdrop ?? null), accent: ARAB_SAND },
  ]

  const title = t('dramas.shelf.title')
  return (
    <section aria-label={title} className="w-full">
      <SectionHeader title={title} subtitle={t('dramas.shelf.subtitle')} />
      <Row label={title} itemClassName={LANDSCAPE_WIDTH}>
        {doors.map(({ key, ...door }) => <HubTile key={key} {...door} size="shelf" />)}
      </Row>
    </section>
  )
}
