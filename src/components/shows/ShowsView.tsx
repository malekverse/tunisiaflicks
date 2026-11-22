"use client"
// My shows (/shows): every series you're watching, where you are in it, and what's next. Up next:
// the episode after yours, ready to play, and how many are left. Coming soon: caught up, with the
// date of the next episode and a bell for it. Waiting for news, and finished. The data comes from
// the server (lib/tracker-server); taking a show off removes it from the watch history, as on
// Continue watching.
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { Bell, BellRing, CalendarClock, Check, Hourglass, Play, RotateCw, Tv, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import PageHeader from '@/src/components/browse/PageHeader'
import { EmptyState } from '@/src/components/MediaGrid'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { useFollow } from '@/src/hooks/use-follow'
import { toast } from '@/src/hooks/use-toast'
import { removeFromWatchHistory } from '@/src/lib/user-content'
import { daysUntil } from '@/src/lib/tracker'
import type { TrackedShow } from '@/src/lib/tracker-server'
import { spring } from '@/src/lib/motion'
import CalendarFeedCard from '@/src/components/calendar/CalendarFeedCard'
import { cn } from '@/src/lib/utils'

const SECTION_TITLE = 'mb-4 font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]'

function episodeCode(t: ReturnType<typeof useI18n>['t'], season: number, episode: number) {
  return t('common.seasonEpisode', { season, episode })
}

function ProgressBar({ show, className }: { show: TrackedShow, className?: string }) {
  const { t } = useI18n()
  const { position, aired } = show.progress
  const percent = aired ? Math.round((position / aired) * 100) : 0
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={aired}
      aria-valuenow={position}
      aria-label={t('shows.progressAria', { watched: position, total: aired })}
      className={cn('block h-1.5 overflow-hidden rounded-full bg-white/[0.1]', className)}
    >
      <span className="block h-full rounded-full bg-red-600" style={{ width: `${percent}%` }} />
    </span>
  )
}

function BellButton({ show, compact = false }: { show: TrackedShow, compact?: boolean }) {
  const { t } = useI18n()
  const { following, busy, toggle } = useFollow('tv', show.id)
  return (
    <Button
      type="button"
      size="sm"
      variant={following ? 'secondary' : 'default'}
      onClick={() => toggle(show.title)}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? t('shows.bellOnAria', { title: show.title }) : t('shows.bellAria', { title: show.title })}
      className={cn(compact && 'h-9 px-3')}
    >
      {following ? <BellRing aria-hidden className="h-4 w-4" /> : <Bell aria-hidden className="h-4 w-4" />}
      <span className={cn(compact && 'max-sm:sr-only')}>{following ? t('shows.bellOn') : t('shows.bell')}</span>
    </Button>
  )
}

function UpNextCard({ show, onRemove }: { show: TrackedShow, onRemove: (show: TrackedShow) => void }) {
  const { t } = useI18n()
  const next = show.progress.upNext!
  const href = `/tv/${show.id}?s=${next.season}&e=${next.episode}`
  const still = show.upNext?.still_path
  return (
    <m.li layout exit={{ opacity: 0, scale: 0.96 }} transition={spring.ui} className="group/show relative">
      <Link href={href} aria-label={t('shows.playAria', { title: show.title, episode: episodeCode(t, next.season, next.episode) })} className="block overflow-hidden rounded-tile bg-white/[0.04] outline-none ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500">
        <span className="relative block aspect-video overflow-hidden bg-white/[0.05]">
          <TmdbImage
            kind={still ? 'still' : 'backdrop'}
            path={still || show.backdrop_path}
            name={show.title}
            alt=""
            fill
            sizes="(min-width: 1280px) 420px, (min-width: 640px) 48vw, 100vw"
            className="object-cover transition-transform duration-500 ease-out group-hover/show:scale-[1.03]"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <span aria-hidden className="absolute left-1/2 top-[44%] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-md transition-transform duration-300 group-hover/show:scale-110">
            <Play className="ms-0.5 h-5 w-5 fill-current rtl:-scale-x-100" />
          </span>
          {show.progress.fresh && (
            <span className="absolute start-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[12px] font-semibold text-white">{t('shows.new')}</span>
          )}
          <span className="absolute inset-x-0 bottom-0 p-3.5">
            <span className="block font-display text-[20px] font-bold leading-tight text-white"><bdi dir="auto" className="line-clamp-1">{show.title}</bdi></span>
          </span>
        </span>
        <span className="block p-3.5 pt-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[14px] font-semibold text-white">{episodeCode(t, next.season, next.episode)}</span>
            {show.upNext?.name && <bdi dir="auto" className="truncate text-[14px] text-white/70">{show.upNext.name}</bdi>}
          </span>
          <ProgressBar show={show} className="mt-3" />
          <span className="mt-2 flex flex-wrap gap-x-3 text-[12.5px] text-white/55">
            <span>{t('shows.left', { count: show.progress.left })}</span>
            {show.upNext?.runtime ? <span>{t('shows.runtime', { minutes: show.upNext.runtime })}</span> : null}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onRemove(show)}
        aria-label={t('shows.removeAria', { title: show.title })}
        title={t('shows.remove')}
        className="pressable absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white/85 backdrop-blur-md transition-opacity duration-200 hover:bg-black/80 hover:text-white focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 group-hover/show:opacity-100"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </m.li>
  )
}

function SoonRow({ show }: { show: TrackedShow }) {
  const { t, dateLocale } = useI18n()
  const scheduled = show.scheduled!
  const days = scheduled.air_date ? daysUntil(scheduled.air_date) : null
  const when = days === null ? '' : days <= 0 ? t('shows.today') : days === 1 ? t('shows.tomorrow') : t('shows.inDays', { count: days })
  const date = scheduled.air_date ? new Date(`${scheduled.air_date}T12:00:00Z`).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
  return (
    <li className="flex items-center gap-3.5 rounded-[18px] bg-white/[0.04] p-2.5 pe-3 ring-1 ring-inset ring-white/[0.07]">
      <Link href={`/tv/${show.id}`} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-red-500">
        <span className="relative aspect-[2/3] w-[56px] shrink-0 overflow-hidden rounded-[8px] bg-white/[0.06]">
          <TmdbImage kind="poster" path={show.poster_path} name={show.title} alt="" fill sizes="56px" className="object-cover" />
        </span>
        <span className="min-w-0">
          <bdi dir="auto" className="block truncate text-[15.5px] font-semibold text-white">{show.title}</bdi>
          <span className="mt-0.5 flex min-w-0 gap-2 text-[13px] text-white/65">
            <span className="shrink-0">{episodeCode(t, scheduled.season, scheduled.episode)}</span>
            {scheduled.name && <bdi dir="auto" className="truncate">{scheduled.name}</bdi>}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 text-[12.5px]">
            <span className="font-semibold text-red-400">{when}</span>
            <span className="text-white/55">{date}</span>
          </span>
        </span>
      </Link>
      <BellButton show={show} compact />
    </li>
  )
}

function PosterTile({ show, chip, icon: Icon, bell = false }: { show: TrackedShow, chip: string, icon: React.ElementType, bell?: boolean }) {
  return (
    <li className="flex flex-col">
      <Link href={`/tv/${show.id}`} className="group/tile block rounded-poster outline-none focus-visible:ring-2 focus-visible:ring-red-500">
        <span className="relative block aspect-[2/3] overflow-hidden rounded-poster bg-white/[0.05] ring-1 ring-inset ring-white/[0.07]">
          <TmdbImage kind="poster" path={show.poster_path} name={show.title} alt="" fill sizes="(min-width: 1024px) 180px, 30vw" className="object-cover transition-transform duration-500 group-hover/tile:scale-[1.03]" />
          <span className="absolute inset-x-0 bottom-0 flex bg-gradient-to-t from-black/85 to-transparent p-2 pt-10">
            <span className="glass inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold text-white"><Icon aria-hidden className="h-3.5 w-3.5" />{chip}</span>
          </span>
        </span>
        <bdi dir="auto" className="mt-1.5 block truncate text-[13.5px] text-white/85">{show.title}</bdi>
      </Link>
      {bell && <div className="mt-2"><BellButton show={show} compact /></div>}
    </li>
  )
}

export default function ShowsView({ shows: initial }: { shows: TrackedShow[] | null }) {
  const { t } = useI18n()
  const router = useRouter()
  const [shows, setShows] = useState(initial ?? [])

  const remove = async (show: TrackedShow) => {
    const before = shows
    setShows((current) => current.filter((item) => item.id !== show.id))
    try {
      await removeFromWatchHistory(show.id)
      toast({ title: t('shows.removed'), description: t('shows.removedText', { title: show.title }), duration: 3000 })
    } catch {
      setShows(before)
      toast({ title: t('common.error'), description: t('shows.removeFailed'), variant: 'destructive' })
    }
  }

  const behind = shows.filter((show) => show.progress.shelf === 'behind')
  const soon = shows.filter((show) => show.progress.shelf === 'soon')
  const waiting = shows.filter((show) => show.progress.shelf === 'waiting')
  const finished = shows.filter((show) => show.progress.shelf === 'finished')
  const episodesLeft = behind.reduce((sum, show) => sum + show.progress.left, 0)

  const subtitle = shows.length
    ? (
      <span className="flex flex-wrap gap-x-3">
        <span>{t('shows.watching', { count: shows.length - finished.length })}</span>
        {episodesLeft > 0 && <span>{t('shows.toCatchUp', { count: episodesLeft })}</span>}
      </span>
    )
    : t('shows.subtitle')

  return (
    <div className="pb-12">
      <PageHeader title={t('shows.title')} subtitle={subtitle} />
      <div className="page-x space-y-10 sm:space-y-12">
        {initial === null ? (
          <EmptyState icon={<Tv aria-hidden className="h-6 w-6" />} title={t('shows.failed')} action={<Button variant="secondary" onClick={() => router.refresh()}><RotateCw aria-hidden className="h-4 w-4" />{t('shows.retry')}</Button>}>
            {t('shows.failedText')}
          </EmptyState>
        ) : shows.length === 0 ? (
          <EmptyState icon={<Tv aria-hidden className="h-6 w-6" />} title={t('shows.emptyTitle')} action={<Button asChild><Link href="/tv">{t('shows.browse')}</Link></Button>}>
            {t('shows.emptyText')}
          </EmptyState>
        ) : null}

        {behind.length > 0 && (
          <section aria-labelledby="shows-next">
            <h2 id="shows-next" className={SECTION_TITLE}>{t('shows.upNext')}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false}>
                {behind.map((show) => <UpNextCard key={show.id} show={show} onRemove={remove} />)}
              </AnimatePresence>
            </ul>
          </section>
        )}

        {soon.length > 0 && (
          <section aria-labelledby="shows-soon">
            <h2 id="shows-soon" className={SECTION_TITLE}>{t('shows.soon')}</h2>
            <ul className="grid max-w-[1100px] gap-2.5 lg:grid-cols-2">
              {soon.map((show) => <SoonRow key={show.id} show={show} />)}
            </ul>
          </section>
        )}

        {waiting.length > 0 && (
          <section aria-labelledby="shows-waiting">
            <h2 id="shows-waiting" className={cn(SECTION_TITLE, 'mb-1')}>{t('shows.waiting')}</h2>
            <p className="mb-4 text-[14px] text-white/55">{t('shows.waitingText')}</p>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {waiting.map((show) => <PosterTile key={show.id} show={show} chip={t('shows.upToDate')} icon={Hourglass} bell />)}
            </ul>
          </section>
        )}

        {finished.length > 0 && (
          <section aria-labelledby="shows-done">
            <h2 id="shows-done" className={SECTION_TITLE}>{t('shows.finished')}</h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {finished.map((show) => <PosterTile key={show.id} show={show} chip={t('shows.completed')} icon={Check} />)}
            </ul>
          </section>
        )}

        {shows.length > 0 && (
          <p className="flex items-center gap-2 text-[13px] text-white/50"><CalendarClock aria-hidden className="h-4 w-4" />{t('shows.note')}</p>
        )}

        {/* The bells above, in the phone's own calendar. */}
        {initial !== null && <CalendarFeedCard className="max-w-[880px]" />}
      </div>
    </div>
  )
}
