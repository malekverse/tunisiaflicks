"use client"
// A movie night, for the people in it: when and where, who's coming (and your Going / Can't), the
// film or the vote on it, and the calendar. It keeps itself current: it asks for news every 15
// seconds while it's on screen (every minute once the night has started), and only gets the whole
// night back when something changed (?v=rev).
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronLeft, MapPin, NotebookPen, Share2, X } from 'lucide-react'
import RoomTint from '@/src/components/shell/RoomTint'
import { UserAvatar } from '@/src/components/social/Avatar'
import { socialErrorText } from '@/src/components/social/use-social-self'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import { richT } from '@/src/lib/i18n/rich'
import type { TKey } from '@/src/lib/i18n'
import { haptic, spring, tween } from '@/src/lib/motion'
import { differsForViewer, nightDay, nightTime, viewerZone } from '@/src/lib/movie-night-format'
import { pollInterval, watchWindow } from '@/src/lib/movie-night-rules'
import type { NightView as View } from '@/src/lib/movie-night'
import { openShare } from '@/src/store/share-sheet'
import { cn } from '@/src/lib/utils'
import CalendarActions from './CalendarActions'
import DateTile from './DateTile'
import FilmSection from './FilmSection'
import GuestPanel from './GuestPanel'
import HostMenu from './HostMenu'
import RevealMoment, { markRevealSeen, revealSeen } from './RevealMoment'
import TitlePicker from './TitlePicker'

export type Act = (action: string, body?: Record<string, unknown>, opts?: { refresh?: boolean }) => Promise<{ ok: boolean; data: any }>

const KNOWN = new Set(['cancelled', 'vote_closed', 'picks_full', 'full', 'declined', 'blocked', 'expired', 'chosen'])
const LINK_KEY = (id: string) => `tf-night-link:${id}`

/** Going / Can't: a two-way switch with the sliding white pill (the app's segmented control). */
function Rsvp({ value, onChange, disabled }: { value: 'going' | 'cant' | null; onChange: (going: boolean) => void; disabled?: boolean }) {
  const { t } = useI18n()
  return (
    <div role="radiogroup" aria-label={t('movieNight.rsvp.label')} className="relative flex h-12 w-full max-w-[300px] rounded-full bg-white/[0.07] p-1 ring-1 ring-inset ring-white/[0.06] sm:w-[280px]">
      {(['going', 'cant'] as const).map((option) => {
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => { if (!active) onChange(option === 'going') }}
            className={cn(
              'relative h-10 flex-1 select-none rounded-full px-3 text-[14.5px] font-semibold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50',
              active ? 'text-black' : 'text-white/75 hover:text-white',
            )}
          >
            {active && <m.span layoutId="night-rsvp" transition={spring.snappy} className="absolute inset-0 rounded-full bg-white" />}
            <span className="relative">{t(option === 'going' ? 'movieNight.rsvp.going' : 'movieNight.rsvp.cant')}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function NightView({ initial, created = false }: { initial: View; created?: boolean }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [view, setView] = useState(initial)
  const [zone, setZone] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showCreated, setShowCreated] = useState(created)
  const [reveal, setReveal] = useState(false)
  const rev = useRef(initial.rev)
  rev.current = view.rev
  const id = view.id
  const isHost = view.role === 'host'
  const cancelled = view.status === 'cancelled'

  const refresh = useCallback(async (force = false) => {
    try {
      const response = await fetch(`/api/movie-night/${id}${force ? '' : `?v=${rev.current}`}`, { cache: 'no-store' })
      if (response.status === 404) return router.refresh()
      if (!response.ok) return
      const data = await response.json()
      if (data.same) return
      if (data.access === 'member') setView(data)
      else router.refresh()
    } catch {
      // Offline for a moment: the next tick tries again.
    }
  }, [id, router])

  const act: Act = useCallback(async (action, body = {}, opts = {}) => {
    try {
      const response = await fetch(`/api/movie-night/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const code = typeof data?.code === 'string' ? data.code : ''
        toast({ variant: 'destructive', title: KNOWN.has(code) ? t(`movieNight.errors.${code}` as TKey) : code && code !== 'invalid' ? socialErrorText(t, data) : t('movieNight.actionFailed') })
        if (response.status === 409 || response.status === 404) refresh(true)
        return { ok: false, data }
      }
      if (opts.refresh !== false) await refresh(true)
      return { ok: true, data }
    } catch {
      toast({ variant: 'destructive', title: t('movieNight.actionFailed') })
      return { ok: false, data: null }
    }
  }, [id, refresh, t])

  // News while the page is on screen; a fresh look whenever it comes back into view.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await refresh()
        tick()
      }, pollInterval(view.starts_at, Date.now()))
    }
    tick()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, view.starts_at])

  useEffect(() => {
    setZone(viewerZone())
    if (created) {
      // The address forgets ?created=1, so a reload doesn't say it again.
      try { window.history.replaceState(window.history.state, '', `/movie-night/${id}`) } catch { /* fine */ }
    }
  }, [created, id])

  // The vote's result, once per person (not when nobody voted: there's nothing to reveal).
  const voted = view.candidates.some((candidate) => candidate.votes > 0)
  useEffect(() => {
    if (view.chosen && view.chosen_by === 'vote' && voted && !revealSeen(id, view.chosen.key)) setReveal(true)
  }, [id, view.chosen, view.chosen_by, voted])
  const closeReveal = useCallback(() => {
    if (view.chosen) markRevealSeen(id, view.chosen.key)
    setReveal(false)
  }, [id, view.chosen])

  const vote = async (key: string | null) => {
    if (!view.can.vote) return
    const before = view
    haptic(10)
    // Show it at once; the server's answer (and the next poll) set the real counts.
    setView((current) => ({
      ...current,
      myVote: key,
      candidates: current.candidates.map((candidate) => {
        const was = candidate.mine
        const now = candidate.key === key
        return { ...candidate, mine: now, votes: candidate.votes + (now ? 1 : 0) - (was ? 1 : 0) }
      }),
    }))
    const { ok } = await act('vote', { key })
    if (!ok) setView(before)
  }

  const rsvp = async (going: boolean) => {
    haptic(10)
    const before = view
    setView((current) => ({ ...current, role: going ? 'going' : 'cant' }))
    const { ok } = await act('rsvp', { going })
    if (!ok) setView(before)
  }

  const share = async () => {
    let url: string | null = null
    try { url = localStorage.getItem(LINK_KEY(id)) } catch { url = null }
    if (!url || !view.link?.active) {
      const { ok, data } = await act('link', {}, { refresh: false })
      if (!ok) return
      url = String(data.url)
      try { localStorage.setItem(LINK_KEY(id), url) } catch { /* the link still works this time */ }
      refresh(true)
    }
    openShare({
      kind: 'invite',
      target: 'night',
      url: new URL(url, window.location.origin).toString(),
      title: t('movieNight.share.title', { date: nightDay(view.starts_at, view.tz, locale) }),
      text: t('movieNight.share.text'),
      sendTo: { endpoint: `/api/movie-night/${id}`, body: { action: 'invite' } },
    })
  }

  const title = view.title || t('movieNight.defaultTitle')
  const time = nightTime(view.starts_at, view.tz, locale)
  const mine = zone && differsForViewer(view.starts_at, view.tz, zone) ? nightTime(view.starts_at, zone, locale) : null
  const light = view.chosen?.media.poster_path ?? view.candidates[0]?.media.poster_path ?? null
  const attending = isHost || view.role === 'going'
  const calendarSummary = view.chosen ? t('movieNight.ics.summaryFilm', { title: view.chosen.media.title }) : title
  const showCalendar = attending && !cancelled && !(view.chosen && watchWindow(view.starts_at, Date.now()) === 'now')
  const picksLeft = view.can.suggest

  return (
    <div className="pb-10">
      <RoomTint poster={light} />

      <header className="page-top page-x">
        <Link href="/movie-night" className="-ms-1 inline-flex min-h-11 items-center gap-1 rounded-full pe-3 ps-1 text-[14px] text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
          <ChevronLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />{t('movieNight.back')}
        </Link>

        <AnimatePresence initial={false}>
          {showCreated && isHost && !cancelled && (
            <m.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, transition: spring.ui }}
              exit={{ opacity: 0, y: -8, transition: tween.fast }}
              className="relative mt-3 flex flex-col gap-4 rounded-[22px] bg-white/[0.05] p-5 pe-14 ring-1 ring-inset ring-white/[0.09] sm:flex-row sm:items-center sm:p-6 sm:pe-16"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-[21px] font-bold leading-tight">{t('movieNight.form.created')}</p>
                <p className="mt-1 text-[14px] text-white/65">{t('movieNight.form.createdText')}</p>
              </div>
              <Button type="button" size="lg" onClick={share} className="self-start sm:self-center"><Share2 aria-hidden className="h-[18px] w-[18px]" />{t('movieNight.invite')}</Button>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => setShowCreated(false)}
                className="pressable absolute end-2 top-2 grid h-11 w-11 place-items-center rounded-full text-white/60 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <X aria-hidden className="h-[18px] w-[18px]" />
              </button>
            </m.div>
          )}
        </AnimatePresence>

        <div className="mt-5 flex items-start gap-4 sm:mt-6 sm:gap-6">
          <span className={cn('animate-focus-in', cancelled && 'opacity-50 grayscale')}><DateTile at={view.starts_at} tz={view.tz} size="lg" /></span>
          <div className="min-w-0 flex-1">
            <h1 className={cn('text-balance font-display text-[clamp(32px,5vw,60px)] font-extrabold leading-[0.95] text-white', cancelled && 'text-white/60 line-through decoration-white/30 decoration-[3px]')}>
              <bdi>{title}</bdi>
            </h1>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span dir="ltr" className="font-display text-[28px] font-bold leading-none tabular-nums text-white sm:text-[32px]">{time}</span>
              <span suppressHydrationWarning className="text-[15px] text-white/70">{nightDay(view.starts_at, view.tz, locale)}</span>
              {mine && <span className="text-[13px] text-white/55">{t('movieNight.page.yourTime', { time: mine })}</span>}
            </p>
            <p className="mt-3 flex items-center gap-2 text-[14px] text-white/70">
              <UserAvatar person={view.host} size={24} />
              <span className="min-w-0 truncate">{richT(t, 'movieNight.page.hostedBy', { name: view.host.name }, { bold: ['name'] })}</span>
            </p>
          </div>
        </div>

        {(view.place || view.note) && (
          <div className="mt-5 max-w-[62ch] space-y-2 text-[15px] text-white/80 sm:ms-[116px]">
            {view.place && (
              <p className="flex items-start gap-2.5"><MapPin aria-hidden className="mt-[3px] h-4 w-4 shrink-0 text-white/55" /><span dir="auto" className="min-w-0 break-words">{view.place}</span></p>
            )}
            {view.note && (
              <p className="flex items-start gap-2.5"><NotebookPen aria-hidden className="mt-[3px] h-4 w-4 shrink-0 text-white/55" /><span dir="auto" className="min-w-0 whitespace-pre-line break-words">{view.note}</span></p>
            )}
          </div>
        )}

        {!cancelled && (
          <div className="mt-6 flex flex-wrap items-center gap-3 sm:ms-[116px]">
            {view.can.rsvp && <Rsvp value={view.role === 'going' ? 'going' : view.role === 'cant' ? 'cant' : null} onChange={rsvp} />}
            {isHost && (
              <Button type="button" size="lg" onClick={share}><Share2 aria-hidden className="h-[18px] w-[18px]" />{t('movieNight.invite')}</Button>
            )}
            <HostMenu view={view} act={act} onInvite={share} />
          </div>
        )}
      </header>

      {cancelled && (
        <div className="page-x mt-8">
          <div className="max-w-[640px] rounded-[22px] bg-white/[0.04] p-6 ring-1 ring-inset ring-white/[0.07]">
            <p className="font-display text-[22px] font-bold">{t('movieNight.cancelled.title')}</p>
            <p className="mt-1.5 text-[14px] text-white/60">{t('movieNight.cancelled.text')}</p>
            <Button asChild variant="secondary" className="mt-5"><Link href="/movie-night/new">{t('movieNight.plan')}</Link></Button>
          </div>
        </div>
      )}

      {!cancelled && (
        <div className="page-x mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <FilmSection view={view} act={act} onVote={vote} onAdd={() => setPickerOpen(true)} />
          </div>
          <aside className="min-w-0 space-y-4">
            <GuestPanel view={view} act={act} />
            {showCalendar && (
              <CalendarActions
                id={id}
                start={view.starts_at}
                end={view.ends_at}
                summary={calendarSummary}
                place={view.place}
                className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07]"
              />
            )}
          </aside>
        </div>
      )}

      <TitlePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        heading={isHost ? t('movieNight.vote.add') : t('movieNight.vote.suggest')}
        picked={view.candidates.map((candidate) => candidate.key)}
        full={picksLeft <= 0}
        onPick={async (film) => { await act('addCandidate', { key: film.key }) }}
      />

      <AnimatePresence>
        {reveal && view.chosen && <RevealMoment key={view.chosen.key} candidates={view.candidates} winner={view.chosen.key} onClose={closeReveal} />}
      </AnimatePresence>
    </div>
  )
}
