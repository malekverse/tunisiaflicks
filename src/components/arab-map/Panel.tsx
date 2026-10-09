// The pieces of the map's side panel (server components): rows of posters sized for the panel,
// a country's header and stats, today's pick, the people born there, and the neighbour chips.
// Inside the panel the layout variables are local (no rail, the panel's own gutter), so Row and
// SectionHeader line up with the panel's edges.
import Link from 'next/link'
import { Info, Play, Star, X } from 'lucide-react'
import PosterCard from '@/src/components/PosterCard'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { Button } from '@/src/components/ui/button'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import { cardProps } from '@/src/lib/card-props'
import { arabCountryHref, type ArabCountryCode } from '@/src/lib/arab-countries'
import { neighbours } from '@/src/lib/arab-map'
import { richT } from '@/src/lib/i18n/rich'
import { dateLocale, type Locale } from '@/src/lib/i18n/locales'
import type { Translate } from '@/src/lib/i18n/translate'
import type { CountryPick } from '@/src/lib/arab-cinema'
import type { CountryPerson, MapTitle } from '@/src/lib/country-cinema'
import CountryLink from './CountryLink'

/** Poster width in the panel's rows: a full-width sheet on phones, a narrower column from 1280px. */
export const PANEL_POSTER = 'w-[30vw] max-w-[140px] sm:w-[140px] xl:w-[128px] 2xl:w-[140px]'

/** A row of posters with its title. Nothing when there is nothing to show. */
export function PanelRow({ title, subtitle, items, kind, overlay }: {
  title: string
  subtitle?: string
  items: any[]
  kind: 'movie' | 'tv'
  overlay?: (item: any) => React.ReactNode
}) {
  if (items.length === 0) return null
  return (
    <section aria-label={title}>
      <SectionHeader title={title} subtitle={subtitle} />
      <Row label={title} itemClassName={PANEL_POSTER}>
        {items.map((item) => (
          <PosterCard key={`${kind}-${item.id}`} {...cardProps(item, item.media_type ?? kind)} overlay={overlay?.(item)} />
        ))}
      </Row>
    </section>
  )
}

/** The panel's grid (fewer than 12 titles on record: everything at once). */
export function PanelGrid({ title, items }: { title: string, items: any[] }) {
  return (
    <section aria-label={title}>
      <SectionHeader title={title} />
      <div className="page-x grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-4">
        {items.map((item) => (
          <PosterCard key={`${item.media_type}-${item.id}`} {...cardProps(item, item.media_type)} />
        ))}
      </div>
    </section>
  )
}

function Stat({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] leading-tight text-white/55">{label}</dt>
      <dd className="mt-1 font-display text-[clamp(24px,2.4vw,30px)] font-bold leading-none tabular-nums text-white">{children}</dd>
    </div>
  )
}

/**
 * A country's title: the name as the page's h1 and the close button (back to every country).
 * Needs no data, so it is in the first bytes of the page (the panel's largest paint) while the
 * numbers and rows stream in under it.
 */
export function CountryTitle({ name, t }: { name: string, t: Translate }) {
  return (
    <header className="page-x pt-1 xl:pt-8">
      <div className="flex items-start justify-between gap-3">
        <h1 dir="auto" className="min-w-0 text-balance font-display text-[clamp(40px,5.2vw,68px)] font-extrabold leading-[0.95] text-white">{name}</h1>
        <CountryLink
          href="/arab-cinema"
          aria-label={t('arabMap.close')}
          title={t('arabMap.close')}
          className="pressable -me-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/80 outline-none transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={2.2} />
        </CountryLink>
      </div>
    </header>
  )
}

/**
 * Under the title: three numbers (films, series, the first film on record), each a label and a
 * value, and where they come from. The numbers are left out when TMDB has nothing (or didn't answer).
 */
export function CountryStats({ name, films, series, first, locale, t }: {
  name: string
  films: number | null
  series: number | null
  first: MapTitle | null
  locale: Locale
  t: Translate
}) {
  const format = new Intl.NumberFormat(dateLocale(locale))
  return (
    <div className="page-x">
      {films !== null && films + (series ?? 0) > 0 && (
        <dl className="mb-4 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-6 sm:gap-x-8">
          <Stat label={t('arabMap.films')}>{format.format(films)}</Stat>
          <Stat label={t('arabMap.series')}>{format.format(series ?? 0)}</Stat>
          {first?.year ? (
            <Stat label={t('arabMap.first')}>
              <Link href={`/movie/${first.id}`} className="group/first block outline-none focus-visible:underline">
                <span className="tabular-nums">{first.year}</span>
                <span className="mt-1 block truncate font-sans text-[12.5px] font-medium leading-tight text-white/60 transition-colors group-hover/first:text-white"><bdi>{first.title}</bdi></span>
              </Link>
            </Stat>
          ) : <div />}
        </dl>
      )}
      <p className="max-w-[60ch] text-[12.5px] leading-relaxed text-white/50">{richT(t, 'arabMap.sourceCountry', { country: name })}</p>
    </div>
  )
}

/** Today's pick: the film that lights the country's tile, with Play and More info. */
export function PickCard({ pick, locale, t }: { pick: CountryPick, locale: Locale, t: Translate }) {
  const href = `/${pick.kind}/${pick.id}`
  const play = pick.kind === 'tv' ? `/tv/${pick.id}?s=1&e=1` : `${href}#streamSection`
  const length = pick.runtime
    ? pick.runtime < 60 ? t('detail.minutes', { count: pick.runtime }) : t('pick.runtime', { hours: Math.floor(pick.runtime / 60), minutes: pick.runtime % 60 })
    : pick.seasons ? (pick.seasons > 1 ? t('pick.seasons', { count: pick.seasons }) : t('pick.oneSeason')) : ''
  return (
    <section aria-label={t('arabMap.pick')} className="page-x">
      <div className="relative isolate flex gap-4 overflow-hidden rounded-[22px] bg-white/[0.04] p-4 ring-1 ring-white/[0.07] sm:gap-5 sm:p-5">
        <Link href={href} tabIndex={-1} aria-hidden className="relative block aspect-[2/3] w-[92px] shrink-0 self-start overflow-hidden rounded-poster bg-white/[0.06] ring-1 ring-inset ring-white/10 sm:w-[104px]">
          <TmdbImage kind="poster" path={pick.poster} fill sizes="104px" alt="" className="object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-white/60">{t('arabMap.pick')}</p>
          <h2 className="mt-1 font-display text-[clamp(20px,2vw,24px)] font-bold leading-tight text-white"><bdi>{pick.title}</bdi></h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-white/65">
            {pick.vote > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-white">
                <Star aria-hidden className="h-3.5 w-3.5 fill-star text-star" />
                {pick.vote.toFixed(1)}
              </span>
            )}
            {pick.year && <span className="tabular-nums">{pick.year}</span>}
            {length && <span>{length}</span>}
            {pick.genres.length > 0 && <span className="text-white/55">{pick.genres.join(' / ')}</span>}
          </p>
          {pick.overview && <p className="mt-2 line-clamp-2 max-w-[60ch] text-[13.5px] leading-relaxed text-white/70 sm:line-clamp-3" dir="auto">{pick.overview}</p>}
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <Button asChild className="h-11">
              <Link href={play}><Play aria-hidden className="h-[18px] w-[18px] fill-current" />{t('billboard.play')}</Link>
            </Button>
            <Button asChild variant="secondary" className="h-11">
              <Link href={href}><Info aria-hidden className="h-[18px] w-[18px]" />{t('pick.moreInfo')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/** People born in the country (cast and directors of its best-known titles). */
export function PeopleRow({ title, people }: { title: string, people: CountryPerson[] }) {
  if (people.length === 0) return null
  return (
    <section aria-label={title}>
      <SectionHeader title={title} />
      <Row label={title} itemClassName="w-[92px] sm:w-[104px]" gap="gap-3 sm:gap-4">
        {people.map((person) => (
          <Link key={person.id} href={`/person/${person.id}`} className="group/person block text-center outline-none">
            <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 ease-out group-hover/person:-translate-y-1 group-hover/person:ring-white/40 group-focus-visible/person:ring-2 group-focus-visible/person:ring-red-500">
              {/* The name is right under it: the photo adds nothing for a screen reader. */}
              <TmdbImage kind="profile" path={person.profile_path} fill sizes="104px" alt="" className="object-cover object-[50%_25%]" />
            </span>
            <bdi className="mt-2 block truncate text-[13px] font-medium text-white/90">{person.name}</bdi>
            <span className="block truncate text-[12px] text-white/50"><bdi>{person.knownFor}</bdi></span>
          </Link>
        ))}
      </Row>
    </section>
  )
}

/** Up to four neighbouring countries, as navigation chips (Tunisia goes to its own cinema page). */
export function Neighbours({ code, nameOf, t, bare = false }: {
  code: ArabCountryCode
  nameOf: (code: ArabCountryCode) => string
  t: Translate
  /** Inside an empty state: the chips only, centred. */
  bare?: boolean
}) {
  const label = t('arabMap.neighbours')
  const chips = (
    <ChipGroup label={label} mode="nav" className={bare ? 'justify-center' : undefined}>
      {neighbours(code).map((other) => (
        <Chip key={other} href={arabCountryHref(other)}><bdi>{nameOf(other)}</bdi></Chip>
      ))}
    </ChipGroup>
  )
  if (bare) return chips
  return (
    <section aria-label={label}>
      <SectionHeader title={label} />
      <div className="page-x">{chips}</div>
    </section>
  )
}
