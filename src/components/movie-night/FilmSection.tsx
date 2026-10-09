"use client"
// The night's film. Before it's known: the ballot (the films as posters you tap to vote for, with
// live counts and the faces of who voted), the host's 'Choose this', 'Close the vote', and 'Pick
// together' through a Swipe room. Once known: the film itself, lit large, with Watch now around
// the start, or the calendar before.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { Check, Crown, HeartHandshake, Info, Play, Plus, Trash2, Vote } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { AvatarStack } from '@/src/components/social/Avatar'
import { saveCredentials, saveName } from '@/src/components/swipe/storage'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { richT } from '@/src/lib/i18n/rich'
import { haptic, spring } from '@/src/lib/motion'
import { nightDayShort, nightTime } from '@/src/lib/movie-night-format'
import { watchWindow } from '@/src/lib/movie-night-rules'
import type { CandidateView, NightView } from '@/src/lib/movie-night'
import { cn } from '@/src/lib/utils'
import type { Act } from './NightView'

const sectionTitle = 'font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]'

function countLabel(t: ReturnType<typeof useI18n>['t'], count: number) {
  return count === 0 ? t('movieNight.vote.countZero') : count === 1 ? t('movieNight.vote.countOne') : t('movieNight.vote.count', { count })
}

/** One film on the ballot: the poster is the vote button; Choose and Remove sit beside it, never inside. */
function Ballot({ candidate, view, max, onVote, act }: { candidate: CandidateView; view: NightView; max: number; onVote: (key: string | null) => void; act: Act }) {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const [busy, setBusy] = useState(false)
  const isHost = view.role === 'host'
  const share = max > 0 ? candidate.votes / max : 0
  const leading = candidate.votes > 0 && candidate.votes === max
  const canRemove = view.vote.open && (isHost || candidate.addedByMe)

  return (
    <li className="group/ballot min-w-0">
      <div className="relative">
        <button
          type="button"
          aria-pressed={candidate.mine}
          aria-label={t('movieNight.vote.voteFor', { title: candidate.media.title })}
          disabled={!view.can.vote}
          onClick={() => onVote(candidate.mine ? null : candidate.key)}
          className={cn(
            'group relative block aspect-[2/3] w-full overflow-hidden rounded-poster bg-white/[0.06] outline-none ring-1 ring-inset ring-white/10 transition-[transform,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-default',
            view.can.vote && 'pressable active:scale-[0.97]',
            candidate.mine && 'shadow-[0_18px_40px_-16px_rgb(229_15_5/0.75)]',
          )}
        >
          <TmdbImage kind="poster" path={candidate.media.poster_path} alt="" fill sizes="(min-width: 1280px) 190px, (min-width: 640px) 30vw, 45vw" className="object-cover" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {/* Your vote: the red ring (the room's signal) and a check. */}
          <span aria-hidden className={cn('pointer-events-none absolute inset-0 rounded-poster ring-[3px] ring-inset transition-colors duration-200', candidate.mine ? 'ring-red-500' : 'ring-transparent')} />
          <AnimatePresence>
            {candidate.mine && (
              <m.span
                aria-hidden
                initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={spring.pop}
                className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-red-600 text-white shadow-[0_8px_20px_-6px_rgb(229_15_5/0.9)] ring-2 ring-black"
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </m.span>
            )}
          </AnimatePresence>
          {view.can.vote && !candidate.mine && (
            <span aria-hidden className="absolute inset-x-2 bottom-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-black/55 text-[13px] font-semibold text-white opacity-100 backdrop-blur-md transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:opacity-100">
              <Vote className="h-4 w-4" />{t('movieNight.vote.vote')}
            </span>
          )}
          {candidate.mine && (
            <span aria-hidden className="absolute inset-x-2 bottom-2 inline-flex h-9 items-center justify-center rounded-full bg-black/55 text-[13px] font-semibold text-white backdrop-blur-md">{t('movieNight.vote.yours')}</span>
          )}
        </button>
        {canRemove && (
          <button
            type="button"
            aria-label={t('movieNight.vote.remove', { title: candidate.media.title })}
            disabled={busy}
            onClick={async () => { setBusy(true); await act('removeCandidate', { key: candidate.key }); setBusy(false) }}
            className="pressable absolute start-1 top-1 grid h-11 w-11 place-items-center rounded-full outline-none transition-opacity duration-150 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/ballot:opacity-100"
          >
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white/85 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white">
              <Trash2 className="h-4 w-4" />
            </span>
          </button>
        )}
      </div>

      <p className="mt-2.5 truncate text-[14.5px] font-medium text-white"><bdi dir="auto">{candidate.media.title}</bdi></p>
      {/* The tally: a bar against the leader's count (transform only), the count, and who voted. */}
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <span
          className={cn('block h-full w-full origin-left rounded-full transition-transform duration-300 ease-out rtl:origin-right', leading ? 'bg-white' : 'bg-white/45')}
          style={{ transform: `scaleX(${share})` }}
        />
      </div>
      <div className="mt-2 flex min-h-6 items-center justify-between gap-2">
        <span className={cn('text-[13px] tabular-nums', leading ? 'text-white' : 'text-white/60')}>{countLabel(t, candidate.votes)}</span>
        {candidate.voters.length > 0 && <AvatarStack people={candidate.voters} total={candidate.voters.length} size={24} />}
      </div>
      {isHost && view.status === 'planned' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label={t('movieNight.vote.chooseFor', { title: candidate.media.title })}
          onClick={async () => { setBusy(true); await act('choose', { key: candidate.key }); setBusy(false) }}
          className="-ms-2 mt-1 h-11 px-2.5 text-[13.5px] text-white/75"
        >
          <Crown aria-hidden className="h-4 w-4" />{t('movieNight.vote.choose')}
        </Button>
      )}
    </li>
  )
}

function ChosenFilm({ view }: { view: NightView }) {
  const { t } = useI18n()
  const film = view.chosen!
  const href = `/${film.media.media_type}/${film.media.id}`
  const when = watchWindow(view.starts_at, Date.now())
  const by = view.chosen_by === 'vote' ? t('movieNight.film.byVote') : view.chosen_by === 'swipe' ? t('movieNight.film.bySwipe') : t('movieNight.film.byHost')
  return (
    <div className="relative overflow-hidden rounded-stage bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]">
      <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
        {film.backdrop_path || film.media.poster_path ? (
          <TmdbImage kind={film.backdrop_path ? 'backdrop' : 'poster'} path={film.backdrop_path || film.media.poster_path} alt="" fill priority sizes="(min-width: 1024px) 760px, 100vw" className="object-cover" />
        ) : null}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0b0b0c] via-black/20 to-transparent" />
      </div>
      <div className="relative -mt-14 flex items-end gap-4 px-5 pb-5 sm:-mt-20 sm:gap-6 sm:px-7 sm:pb-7">
        <span className="relative hidden aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-poster bg-white/[0.06] shadow-[0_24px_50px_-18px_rgb(0_0_0/0.95)] ring-1 ring-white/15 sm:block">
          <TmdbImage kind="poster" path={film.media.poster_path} alt="" fill sizes="104px" className="object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white/65">{by}</p>
          <h2 className="mt-1 text-balance font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[0.98] text-white">
            {richT(t, 'movieNight.film.watching', { title: film.media.title })}
          </h2>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {when === 'now' && view.status === 'planned' && (
              <Button asChild size="lg"><Link href={`${href}#streamSection`}><Play aria-hidden className="h-5 w-5 fill-current" />{t('movieNight.film.watchNow')}</Link></Button>
            )}
            <Button asChild size="lg" variant="secondary"><Link href={href}><Info aria-hidden className="h-5 w-5" />{t('movieNight.film.details')}</Link></Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FilmSection({ view, act, onVote, onAdd }: { view: NightView; act: Act; onVote: (key: string | null) => void; onAdd: () => void }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [confirmClose, setConfirmClose] = useState(false)
  const [opening, setOpening] = useState(false)
  const isHost = view.role === 'host'
  const max = Math.max(0, ...view.candidates.map((candidate) => candidate.votes))
  const leader = view.candidates.find((candidate) => candidate.votes === max && max > 0)

  const pickTogether = async () => {
    if (view.room) return router.push(`/swipe/${view.room.code}`)
    setOpening(true)
    const { ok, data } = await act('room', {}, { refresh: false })
    setOpening(false)
    if (!ok) return
    if (data.name) saveName(String(data.name))
    if (data.participant) saveCredentials(data.code, data.participant)
    haptic(12)
    router.push(`/swipe/${data.code}`)
  }

  if (view.chosen) {
    return (
      <section id="film" aria-label={t('movieNight.film.title')} className="scroll-mt-[calc(var(--topbar)+24px)]">
        <ChosenFilm view={view} />
      </section>
    )
  }

  const closes = new Date(view.vote.closes_at)
  const sameDay = nightDayShort(closes, view.tz, locale) === nightDayShort(view.starts_at, view.tz, locale)
  const closeText = view.vote.open
    ? sameDay
      ? t('movieNight.vote.closesSoon', { time: nightTime(closes, view.tz, locale) })
      : t('movieNight.vote.closes', { when: `${nightDayShort(closes, view.tz, locale)} ${nightTime(closes, view.tz, locale)}` })
    : t('movieNight.vote.closed')

  return (
    <section id="film" aria-labelledby="night-film" className="scroll-mt-[calc(var(--topbar)+24px)]">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="night-film" className={sectionTitle}>{t('movieNight.vote.title')}</h2>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-white/60">
            <span>{closeText}</span>
            {view.candidates.length > 1 && <span>{t('movieNight.vote.rule')}</span>}
          </p>
        </div>
        {isHost && view.vote.open && view.candidates.length > 0 && (
          <Button type="button" variant="secondary" size="sm" className="h-11 px-4 text-[14px] sm:h-9" onClick={() => setConfirmClose(true)}>{t('movieNight.vote.close')}</Button>
        )}
      </div>

      {/* One message for screen readers when the lead changes (not one live region per count). */}
      <p role="status" aria-atomic="true" className="sr-only">
        {leader ? t('movieNight.vote.status', { title: leader.media.title, count: leader.votes }) : ''}
      </p>

      {view.candidates.length === 0 ? (
        <div className="mt-5 rounded-[22px] bg-white/[0.03] p-6 text-center ring-1 ring-inset ring-white/[0.06]">
          <p className="font-display text-[19px] font-bold">{view.vote.open ? t('movieNight.vote.empty') : t('movieNight.vote.noFilm')}</p>
          <p className="mx-auto mt-1.5 max-w-[44ch] text-[14px] text-white/60">{view.vote.open ? (isHost ? t('movieNight.vote.emptyHost') : '') : t('movieNight.vote.noFilmText')}</p>
          {view.can.suggest > 0 && (
            <Button type="button" className="mt-5" onClick={onAdd}><Plus aria-hidden className="h-[18px] w-[18px]" />{isHost ? t('movieNight.vote.add') : t('movieNight.vote.suggest')}</Button>
          )}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 xl:grid-cols-4">
          {view.candidates.map((candidate) => (
            <Ballot key={candidate.key} candidate={candidate} view={view} max={max} onVote={onVote} act={act} />
          ))}
          {view.can.suggest > 0 && (
            <li>
              <button
                type="button"
                onClick={onAdd}
                className="pressable flex aspect-[2/3] w-full flex-col items-center justify-center gap-3 rounded-poster border border-dashed border-white/20 bg-white/[0.02] px-3 text-center text-[14px] font-medium text-white/75 outline-none transition-colors duration-150 hover:border-white/35 hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.08]"><Plus aria-hidden className="h-5 w-5" /></span>
                {isHost ? t('movieNight.vote.add') : t('movieNight.vote.suggest')}
              </button>
            </li>
          )}
        </ul>
      )}

      {view.candidates.length > 0 && (
        <p className="mt-5 flex flex-wrap gap-x-3 text-[13px] text-white/55">
          <span>{t('movieNight.vote.progress', { count: view.vote.total, total: view.vote.voters })}</span>
          {view.role === 'cant' && view.vote.open && <span>{t('movieNight.vote.cantVote')}</span>}
        </p>
      )}

      {view.can.pickTogether && (
        <div className="mt-8 flex flex-col gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.08]"><HeartHandshake className="h-6 w-6 text-white/85" strokeWidth={1.8} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold text-white">{t('movieNight.together.title')}</h3>
            <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-white/60">{t('movieNight.together.text')}</p>
          </div>
          <Button type="button" variant="secondary" size="lg" disabled={opening} onClick={pickTogether} className="shrink-0">
            {view.room ? t('movieNight.together.open') : t('movieNight.together.action')}
          </Button>
        </div>
      )}

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-[420px] p-6">
          <DialogTitle className="font-display text-[22px] font-bold">{t('movieNight.vote.closeTitle')}</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-white/65">{t('movieNight.vote.closeText')}</DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => setConfirmClose(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={async () => { setConfirmClose(false); await act('closeVote') }}>{t('movieNight.vote.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
