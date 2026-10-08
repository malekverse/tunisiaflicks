// The rows of a drama hub (server components, each streamed in its own Suspense). A row with too
// few titles renders nothing (see rowMinimum); a slow source can't hold the page (withTimeout).
import Link from 'next/link'
import { History, Play } from 'lucide-react'
import PosterCard, { SkeletonLoader as PosterSkeleton } from '@/src/components/PosterCard'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { LANDSCAPE_WIDTH, POSTER_WIDTH } from '@/src/components/dramas/widths'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { withCallback } from '@/src/components/auth/links'
import { cardProps } from '@/src/lib/card-props'
import { getActiveProfile } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { richT } from '@/src/lib/i18n/rich'
import { dateLocale, type Locale, type TKey, type Translate } from '@/src/lib/i18n'
import { withTimeout } from '@/src/lib/with-timeout'
import { getShelf, type DramaItem } from '@/src/lib/dramas'
import { getDramasForYou } from '@/src/lib/dramas-for-you'
import { hubPath, pluralKey, rowMinimum, type AirState, type DataShelf, type FilterShelf, type HubId } from '@/src/lib/dramas-config'
import { cn } from '@/src/lib/utils'

const ROW_TIMEOUT_MS = 9000

function weekday(date: string, locale: Locale) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', { weekday: 'long', timeZone: 'UTC' })
}

/** When the series' episode is out: fresh ones (today, the last two days) in white, coming ones on glass. */
export function AirBadge({ air, t, locale }: { air: AirState, t: Translate, locale: Locale }) {
  const label = air.kind === 'today' ? t('dramas.badge.today')
    : air.kind === 'new' ? t('dramas.badge.new')
      : air.kind === 'tomorrow' ? t('dramas.badge.tomorrow')
        : t('dramas.badge.next', { day: weekday(air.date, locale) })
  const fresh = air.kind === 'today' || air.kind === 'new'
  return (
    <span className={cn('absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[11.5px] font-semibold', fresh ? 'bg-white text-black' : 'glass text-white')}>
      {label}
    </span>
  )
}

/** How many episodes a short series has. */
export function EpisodesBadge({ count, t, locale }: { count: number, t: Translate, locale: Locale }) {
  return (
    <span className="glass absolute bottom-2 start-2 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-white">
      {t(pluralKey('dramas.episodes', locale, count) as TKey, { count })}
    </span>
  )
}

/** The overlay a title gets on its poster, by shelf. */
export function badgeFor(item: DramaItem, t: Translate, locale: Locale) {
  if (item.air) return <AirBadge air={item.air} t={t} locale={locale} />
  if (item.episodes) return <EpisodesBadge count={item.episodes} t={t} locale={locale} />
  return undefined
}

/** Placeholder while a row loads: its title bar and a few poster frames. */
export function RowSkeleton() {
  return (
    <div aria-hidden className="w-full">
      <div className="page-x mb-3 sm:mb-4">
        <Skeleton className="h-6 w-56 rounded-full sm:h-7" />
      </div>
      <div className="rail-x flex gap-3 overflow-hidden px-[var(--gutter)] sm:gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className={cn('shrink-0', POSTER_WIDTH)}>
            <PosterSkeleton />
          </div>
        ))}
      </div>
    </div>
  )
}

function PosterRow({ title, label, subtitle, href, items }: { title: React.ReactNode, label: string, subtitle?: string, href?: string, items: DramaItem[] }) {
  const t = getT()
  const locale = getLocale()
  return (
    <section aria-label={label} className="w-full">
      <SectionHeader title={title} subtitle={subtitle} href={href} />
      <Row label={label} itemClassName={POSTER_WIDTH}>
        {items.map((item) => (
          <PosterCard key={`${item.media_type}-${item.id}`} {...cardProps(item, item.media_type)} overlay={badgeFor(item, t, locale)} />
        ))}
      </Row>
    </section>
  )
}

/** One shelf of the hub as a row, with "See all" when the shelf has its own grid. */
export async function ShelfRow({ hub, shelf, title, seeAll }: { hub: HubId, shelf: DataShelf, title: string, seeAll?: FilterShelf }) {
  const items = await withTimeout(getShelf(hub, shelf, getLocale()), ROW_TIMEOUT_MS, [])
  if (items.length < rowMinimum(shelf)) return null
  return <PosterRow title={title} label={title} items={items} href={seeAll ? hubPath(hub, seeAll) : undefined} />
}

/** This week's ten most popular series of the hub, standing on their rank. */
export async function HubTop10({ hub }: { hub: HubId }) {
  const t = getT()
  const items = await withTimeout(getShelf(hub, 'trending', getLocale(), 10), ROW_TIMEOUT_MS, [])
  if (items.length < rowMinimum('trending')) return null
  const title = t(`dramas.row.top10.${hub}` as TKey)
  return (
    <section aria-label={title}>
      <SectionHeader title={title} subtitle={t('dramas.row.top10Note')} />
      <Row label={title} gap="gap-1 sm:gap-2" itemClassName="w-[50vw] max-w-[220px] sm:w-[236px] sm:max-w-none lg:w-[256px] 2xl:w-[290px]">
        {items.map((item, index) => (
          <div key={item.id} className="group/rank flex items-end">
            <span
              aria-label={t('home.rank', { rank: index + 1 })}
              className="numeral-outline relative -me-[3%] w-[48%] shrink-0 select-none text-end font-display text-[clamp(150px,15.5vw,236px)] font-extrabold leading-[0.72] tracking-[-0.09em] transition-[-webkit-text-stroke-color] duration-300 group-hover/rank:[-webkit-text-stroke-color:rgb(255_36_20/0.85)]"
            >
              {index + 1}
            </span>
            <div className="relative w-[55%] shrink-0">
              <PosterCard {...cardProps(item, 'tv')} bare />
            </div>
          </div>
        ))}
      </Row>
    </section>
  )
}

/** A series to pick up again: its picture, and the episode it reopens on. */
function ResumeTile({ title, backdrop, poster, href, label, episodeLabel }: { title: string, backdrop: string | null, poster: string | null, href: string, label: string, episodeLabel: string }) {
  return (
    <Link href={href} aria-label={label} className="group/resume block select-none outline-none [-webkit-touch-callout:none]">
      <span className="relative block aspect-video overflow-hidden rounded-tile bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-transform duration-150 ease-out group-active/resume:scale-[0.98] group-focus-visible/resume:ring-2 group-focus-visible/resume:ring-red-500">
        <TmdbImage
          kind={backdrop ? 'backdrop' : 'poster'}
          path={backdrop ?? poster}
          alt=""
          fill
          sizes="(min-width: 1536px) 360px, (min-width: 640px) 320px, 74vw"
          className="object-cover transition-transform duration-500 ease-out group-hover/resume:scale-[1.04]"
        />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />
        <span aria-hidden className="glass absolute bottom-3 start-3 grid h-10 w-10 place-items-center rounded-full text-white transition-transform duration-200 group-hover/resume:scale-105">
          <Play className="ms-0.5 h-4 w-4 fill-current rtl:-scale-x-100" />
        </span>
        <span className="absolute bottom-3.5 end-3 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white">
          {episodeLabel}
        </span>
      </span>
      <span dir="auto" className="mt-2.5 block truncate px-0.5 text-[13.5px] font-medium text-white/90">{title}</span>
    </Link>
  )
}

/** Signed out: what this space would do, and the way in (back to this hub afterwards). */
function ForYouInvite({ callbackUrl }: { callbackUrl: string }) {
  const t = getT()
  return (
    <section className="page-x">
      <div className="flex flex-col gap-5 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:flex-row sm:items-center sm:p-6">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/80">
          <History className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[21px] font-bold leading-tight text-white">{t('dramas.forYou.inviteTitle')}</h2>
          <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-white/60">{t('dramas.forYou.inviteText')}</p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link href={withCallback('/login', callbackUrl)}>{t('nav.signIn')}</Link>
        </Button>
      </div>
    </section>
  )
}

/**
 * For a signed-in grown-up: the hub's series to pick up again, then "Because you watched X".
 * Guests get the invitation; a profile with nothing from this hub yet, nothing.
 */
export async function ForYouRows({ hub }: { hub: HubId }) {
  const t = getT()
  const locale = getLocale()
  const active = await getActiveProfile()
  if (!active) return <ForYouInvite callbackUrl={hubPath(hub)} />
  const data = await withTimeout(getDramasForYou(hub, locale), ROW_TIMEOUT_MS, null)
  if (!data) return null
  const resumeTitle = t('dramas.forYou.resume')
  return (
    <>
      {data.resume.length > 0 && (
        <section aria-label={resumeTitle} className="w-full">
          <SectionHeader title={resumeTitle} />
          <Row label={resumeTitle} itemClassName={LANDSCAPE_WIDTH}>
            {data.resume.map((item) => (
              <ResumeTile
                key={item.id}
                title={item.title}
                backdrop={item.backdrop}
                poster={item.poster}
                href={item.href}
                episodeLabel={t('common.seasonEpisode', { season: item.season, episode: item.episode })}
                label={`${t('home.resumeTitle', { title: item.title })}, ${t('common.seasonEpisode', { season: item.season, episode: item.episode })}`}
              />
            ))}
          </Row>
        </section>
      )}
      {data.because && (
        <PosterRow
          title={richT(t, 'dramas.forYou.because', { title: data.because.seed.title })}
          label={t('dramas.forYou.because', { title: data.because.seed.title })}
          items={data.because.items}
        />
      )}
    </>
  )
}
