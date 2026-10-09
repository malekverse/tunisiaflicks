"use client"
// Planning a night (and editing one): when (quick chips, then the native date and time pickers),
// the films to vote on, friends to invite, and, folded away, a name, a place and a note. A live
// preview of the night's card sits beside the form on desktop and above the button on phones.
import { useEffect, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { ChevronDown, Film, Lock, MailCheck, Plus, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'
import FriendPicker from '@/src/components/social/FriendPicker'
import ProfileSetupCard from '@/src/components/social/ProfileSetupCard'
import { invalidateSocialSelf } from '@/src/components/social/use-social-self'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { haptic, spring, tween } from '@/src/lib/motion'
import {
  DEFAULT_TZ, GUESTS_MAX, HOST_PICKS_MAX, NIGHT_NOTE_MAX, PLACE_MAX, TITLE_MAX, addDays, checkStart, checkVoteClose, defaultTime, isTimeZone,
  quickDays, zonedDay, zonedTime, zonedToUtc, type QuickDay, type StartProblem,
} from '@/src/lib/movie-night-rules'
import { viewerZone, zoneCity } from '@/src/lib/movie-night-format'
import type { AvatarPerson } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'
import NightCard from './NightCard'
import TitlePicker, { type PickedFilm } from './TitlePicker'

const MINUTE = 60_000
const CLOSE_OPTIONS = [
  { id: 'day', before: 24 * 60 * MINUTE },
  { id: 'h6', before: 6 * 60 * MINUTE },
  { id: 'h2', before: 2 * 60 * MINUTE },
  { id: 'h1', before: 60 * MINUTE },
  { id: 'm30', before: 30 * MINUTE },
  { id: 'start', before: 0 },
] as const
type CloseId = (typeof CLOSE_OPTIONS)[number]['id']

export type NightFormInitial = {
  id: string
  title: string
  place: string
  note: string
  starts_at: string
  tz: string
  vote_closes_at: string
  voteOpen: boolean
}

const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6'
const fieldLabel = 'text-[13px] font-normal text-white/70'
const sectionTitle = 'font-display text-[21px] font-bold leading-tight text-white'

const PROBLEM_KEY: Record<StartProblem, 'movieNight.form.errors.past' | 'movieNight.form.errors.tooSoon' | 'movieNight.form.errors.tooFar'> = {
  past: 'movieNight.form.errors.past',
  too_soon: 'movieNight.form.errors.tooSoon',
  too_far: 'movieNight.form.errors.tooFar',
}

export default function NightForm({ mode, initial, prefill, account: initialAccount, host }: {
  mode: 'new' | 'edit'
  initial?: NightFormInitial
  /** ?title=movie:550: a first film to vote on. */
  prefill?: PickedFilm | null
  /** Whether this person can plan a night yet (a page, a verified e-mail). */
  account: 'ok' | 'needs_handle' | 'unverified'
  /** For the preview. */
  host: AvatarPerson
}) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const ids = useId()
  const reduce = useReducedMotion()
  const [account, setAccount] = useState(initialAccount)
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [tz, setTz] = useState(initial?.tz ?? DEFAULT_TZ)
  const [chips, setChips] = useState<QuickDay[]>([])
  const [day, setDay] = useState(initial ? zonedDay(new Date(initial.starts_at), initial.tz) : '')
  const [time, setTime] = useState(initial ? zonedTime(new Date(initial.starts_at), initial.tz) : '21:00')
  const [timeTouched, setTimeTouched] = useState(!!initial)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [place, setPlace] = useState(initial?.place ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [detailsOpen, setDetailsOpen] = useState(!!(initial?.title || initial?.place || initial?.note))
  const [picks, setPicks] = useState<PickedFilm[]>(prefill ? [prefill] : [])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [invite, setInvite] = useState<string[]>([])
  const [closeId, setCloseId] = useState<CloseId>('h2')
  const [closeTouched, setCloseTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Everything about "now" and the viewer's zone is decided in the browser (the server can't know).
  useEffect(() => {
    const zone = viewerZone()
    const nightZone = initial?.tz ?? (zone && isTimeZone(zone) ? zone : DEFAULT_TZ)
    const at = Date.now()
    setTz(nightZone)
    setNow(at)
    const quick = quickDays(at, nightZone)
    setChips(quick)
    if (!initial) {
      const first = quick[0]?.day ?? addDays(zonedDay(at, nightZone), 1)
      setDay(first)
      setTime(defaultTime(first))
    }
    setMounted(true)
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [initial])

  const startsAt = useMemo(() => (day && time ? zonedToUtc(day, time, tz) : null), [day, time, tz])
  const problem: StartProblem | null = mounted ? (startsAt ? checkStart(startsAt, now) : 'past') : null
  const closeOptions = useMemo(
    () => CLOSE_OPTIONS.filter((option) => !startsAt || checkVoteClose(startsAt.getTime() - option.before, startsAt, now)),
    [startsAt, now],
  )
  const closeChoice = closeOptions.some((option) => option.id === closeId) ? closeId : closeOptions.find((option) => option.id === 'h2')?.id ?? closeOptions[closeOptions.length - 1]?.id
  const showVoteClose = mode === 'new' ? picks.length >= 2 : !!initial?.voteOpen
  const minDay = mounted ? zonedDay(now, tz) : undefined
  const maxDay = mounted ? addDays(zonedDay(now, tz), 60) : undefined

  const pickDay = (next: string) => {
    setDay(next)
    if (!timeTouched) setTime(defaultTime(next))
    setSubmitError(null)
  }

  /** Only when the host picked a close time; otherwise the server's default (2 hours before). */
  const voteClosesAt = () => {
    if (!startsAt || !closeChoice || !closeTouched || !showVoteClose) return undefined
    const option = CLOSE_OPTIONS.find((entry) => entry.id === closeChoice)!
    return new Date(startsAt.getTime() - option.before).toISOString()
  }

  const errorText = (body: { code?: string } | null, status: number) => {
    const code = body?.code
    if (code === 'past' || code === 'too_soon' || code === 'too_far') return t(PROBLEM_KEY[code])
    if (code === 'limit') return t('movieNight.form.limit')
    if (code === 'rate_limited' || status === 429) return t('api.tooManyAttempts')
    return t('movieNight.form.failed')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    if (!startsAt || problem) return
    if (account !== 'ok') return
    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        starts_at: startsAt.toISOString(),
        tz,
        place: place.trim(),
        note: note.trim(),
        ...(voteClosesAt() ? { vote_closes_at: voteClosesAt() } : {}),
      }
      const response = mode === 'new'
        ? await fetch('/api/movie-night', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, candidates: picks.map((pick) => pick.key), invite }),
        })
        : await fetch(`/api/movie-night/${initial!.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', ...payload }),
        })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        if (body?.code === 'needs_handle') return setAccount('needs_handle')
        if (body?.code === 'unverified') return setAccount('unverified')
        setSubmitError(errorText(body, response.status))
        return
      }
      haptic(16)
      if (mode === 'new') router.push(`/movie-night/${body.id}?created=1`)
      else {
        router.push(`/movie-night/${initial!.id}`)
        router.refresh()
      }
    } catch {
      setSubmitError(t('movieNight.form.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const preview = {
    title: title.trim(),
    starts_at: (startsAt ?? new Date(now + 86400000)).toISOString(),
    tz,
    status: 'planned' as const,
    role: 'host' as const,
    host,
    going: [],
    goingCount: 1,
    posters: picks.map((pick) => pick.media.poster_path).filter((path): path is string => !!path),
    film: null,
    candidateCount: picks.length,
  }
  const disabled = submitting || !mounted || !!problem || account !== 'ok'

  const createButton = (
    <Button type="submit" size="lg" disabled={disabled} className="w-full">
      {mode === 'new' ? (submitting ? t('movieNight.form.creating') : t('movieNight.form.create')) : (submitting ? t('movieNight.form.saving') : t('movieNight.form.save'))}
    </Button>
  )

  return (
    <form onSubmit={submit} noValidate className="page-x grid gap-6 pb-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 max-w-[720px] space-y-4 sm:space-y-5">
        {account === 'needs_handle' && (
          <div className={panel}>
            <p className="mb-4 text-[14px] leading-relaxed text-white/70">{t('movieNight.form.setup')}</p>
            <ProfileSetupCard variant="inline" onCreated={() => { invalidateSocialSelf(); setAccount('ok') }} />
          </div>
        )}
        {account === 'unverified' && (
          <div className={cn(panel, 'flex items-start gap-3')}>
            <MailCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
            <p className="text-[14px] leading-relaxed text-white/70">{t('movieNight.form.verify')} <ResendVerificationButton compact /></p>
          </div>
        )}

        {/* When */}
        <fieldset className={panel} aria-describedby={problem ? `${ids}-when-error` : undefined}>
          <legend className="sr-only">{t('movieNight.form.when')}</legend>
          <p aria-hidden className={sectionTitle}>{t('movieNight.form.when')}</p>
          <div className="mt-4 min-h-10">
            {chips.length > 0 && (
              <ChipGroup label={t('movieNight.form.when')} mode="single" scroll>
                {chips.map((chip) => (
                  <Chip key={chip.id} active={day === chip.day} onClick={() => pickDay(chip.day)}>
                    {/* On a Friday, "Friday" is a week away: say so, so it isn't read as tonight. */}
                    {(chip.id === 'friday' || chip.id === 'saturday') && chip.day === addDays(zonedDay(now, tz), 7)
                      ? t(chip.id === 'friday' ? 'movieNight.chip.nextFriday' : 'movieNight.chip.nextSaturday')
                      : t(`movieNight.chip.${chip.id}`)}
                  </Chip>
                ))}
              </ChipGroup>
            )}
          </div>
          <div className="mt-5 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${ids}-date`} className={fieldLabel}>{t('movieNight.form.date')}</Label>
              <Input
                id={`${ids}-date`}
                type="date"
                value={day}
                min={minDay}
                max={maxDay}
                required
                onChange={(event) => event.target.value && pickDay(event.target.value)}
                aria-invalid={!!problem}
                className="h-12 text-[16px] [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${ids}-time`} className={fieldLabel}>{t('movieNight.form.time')}</Label>
              <Input
                id={`${ids}-time`}
                type="time"
                value={time}
                step={300}
                required
                onChange={(event) => { if (event.target.value) { setTime(event.target.value); setTimeTouched(true); setSubmitError(null) } }}
                aria-invalid={!!problem}
                className="h-12 text-[16px] tabular-nums [color-scheme:dark]"
              />
            </div>
          </div>
          <p className="mt-3 text-[13px] text-white/55">{t('movieNight.form.zone', { zone: zoneCity(tz) })}</p>
          {problem && <p id={`${ids}-when-error`} role="alert" className="mt-2 text-[13px] text-red-400">{t(PROBLEM_KEY[problem])}</p>}
        </fieldset>

        {/* Films to vote on (new nights; an existing night's are managed on its page) */}
        {mode === 'new' && (
          <section className={panel} aria-labelledby={`${ids}-picks`}>
            <h2 id={`${ids}-picks`} className={sectionTitle}>{t('movieNight.form.picks')}</h2>
            <p className="mt-1.5 max-w-[56ch] text-[14px] leading-relaxed text-white/60">{t('movieNight.form.picksHint')}</p>
            <ul className="mt-4 space-y-2">
              <AnimatePresence initial={false}>
                {picks.map((pick) => (
                  <m.li
                    key={pick.key}
                    layout={!reduce}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: spring.ui }}
                    exit={{ opacity: 0, transition: tween.fast }}
                    className="flex items-center gap-3 rounded-[16px] bg-white/[0.04] p-2 pe-1 ring-1 ring-inset ring-white/[0.06]"
                  >
                    <span className="relative h-[60px] w-10 shrink-0 overflow-hidden rounded-[7px] bg-white/[0.06]">
                      <TmdbImage kind="poster" path={pick.media.poster_path} alt="" fill sizes="40px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <bdi dir="auto" className="block truncate text-start text-[15px] font-medium text-white">{pick.media.title}</bdi>
                      <span className="flex gap-x-3 text-[12.5px] text-white/55">
                        <span>{pick.media.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
                        {pick.year && <span className="tabular-nums">{pick.year}</span>}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicks((current) => current.filter((entry) => entry.key !== pick.key))}
                      aria-label={t('movieNight.form.removePick', { title: pick.media.title })}
                      className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/70 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <X aria-hidden className="h-[18px] w-[18px]" />
                    </button>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
            {picks.length === 0 && (
              <p className="mt-1 flex items-center gap-2 text-[14px] text-white/55"><Film aria-hidden className="h-4 w-4" />{t('movieNight.form.noPicks')}</p>
            )}
            {picks.length < HOST_PICKS_MAX && (
              <Button type="button" variant="secondary" className="mt-4 h-11" onClick={() => setPickerOpen(true)}>
                <Plus aria-hidden className="h-[18px] w-[18px]" />{t('movieNight.form.addPick')}
              </Button>
            )}
            {showVoteClose && closeOptions.length > 0 && (
              <div className="mt-5 max-w-[280px] space-y-2">
                <Label htmlFor={`${ids}-close`} className={fieldLabel}>{t('movieNight.form.voteClose')}</Label>
                <Select value={closeChoice} onValueChange={(value) => { setCloseId(value as CloseId); setCloseTouched(true) }}>
                  <SelectTrigger id={`${ids}-close`} className="text-[15px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {closeOptions.map((option) => <SelectItem key={option.id} value={option.id}>{t(`movieNight.form.voteClose.${option.id}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>
        )}

        {mode === 'edit' && showVoteClose && closeOptions.length > 0 && (
          <section className={panel}>
            <div className="max-w-[280px] space-y-2">
              <Label htmlFor={`${ids}-close`} className={fieldLabel}>{t('movieNight.form.voteClose')}</Label>
              <Select value={closeTouched ? closeChoice : undefined} onValueChange={(value) => { setCloseId(value as CloseId); setCloseTouched(true) }}>
                <SelectTrigger id={`${ids}-close`} className="text-[15px]"><SelectValue placeholder={t('movieNight.form.voteClose.h2')} /></SelectTrigger>
                <SelectContent>
                  {closeOptions.map((option) => <SelectItem key={option.id} value={option.id}>{t(`movieNight.form.voteClose.${option.id}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </section>
        )}

        {/* Friends */}
        {mode === 'new' && account === 'ok' && (
          <section className={panel} aria-labelledby={`${ids}-invite`}>
            <h2 id={`${ids}-invite`} className={sectionTitle}>{t('movieNight.form.invite')}</h2>
            <p className="mb-4 mt-1.5 max-w-[56ch] text-[14px] leading-relaxed text-white/60">{t('movieNight.form.inviteHint')}</p>
            <FriendPicker selected={invite} onChange={setInvite} max={GUESTS_MAX} />
          </section>
        )}

        {/* Name, place and note: folded away by default */}
        <section className={cn(panel, 'p-0 sm:p-0')}>
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={`${ids}-details`}
            onClick={() => setDetailsOpen((value) => !value)}
            className="flex min-h-[64px] w-full items-center gap-3 rounded-[22px] px-5 text-start outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 sm:px-6"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-white">{t('movieNight.form.details')}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/55"><Lock aria-hidden className="h-3.5 w-3.5" />{t('movieNight.form.detailsHint')}</span>
            </span>
            <ChevronDown aria-hidden className={cn('h-5 w-5 shrink-0 text-white/60 transition-transform duration-200 ease-out', detailsOpen && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {detailsOpen && (
              <m.div
                id={`${ids}-details`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto', transition: spring.ui }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: tween.fast }}
                className="overflow-hidden"
              >
                <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
                  <div className="space-y-2">
                    <Label htmlFor={`${ids}-title`} className={fieldLabel}>{t('movieNight.form.name')}</Label>
                    <Input id={`${ids}-title`} value={title} maxLength={TITLE_MAX} dir="auto" placeholder={t('movieNight.form.namePlaceholder')} onChange={(event) => setTitle(event.target.value)} className="text-[16px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${ids}-place`} className={fieldLabel}>{t('movieNight.form.place')}</Label>
                    <Input id={`${ids}-place`} value={place} maxLength={PLACE_MAX} dir="auto" placeholder={t('movieNight.form.placePlaceholder')} onChange={(event) => setPlace(event.target.value)} className="text-[16px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${ids}-note`} className={fieldLabel}>{t('movieNight.form.note')}</Label>
                    <textarea
                      id={`${ids}-note`}
                      value={note}
                      maxLength={NIGHT_NOTE_MAX}
                      rows={3}
                      dir="auto"
                      placeholder={t('movieNight.form.notePlaceholder')}
                      onChange={(event) => setNote(event.target.value)}
                      className="block w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[16px] leading-snug text-white outline-none transition-[border-color,background-color] duration-200 placeholder:text-white/40 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07] focus-visible:ring-4 focus-visible:ring-red-500/15"
                    />
                    {note.length > NIGHT_NOTE_MAX - 40 && <p className="text-end text-[12px] tabular-nums text-white/55">{NIGHT_NOTE_MAX - note.length}</p>}
                  </div>
                  {(place.trim() || note.trim()) && <p className="text-[13px] leading-relaxed text-white/55">{t('movieNight.form.approvalHint')}</p>}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* The night as friends will see it, and the button */}
      <aside className="min-w-0">
        <div className="space-y-4 lg:sticky lg:top-[calc(var(--topbar)+24px)]">
          <p className="text-[13px] font-medium text-white/60">{t('movieNight.form.preview')}</p>
          {mounted ? <NightCard night={preview} preview /> : <div className="h-[102px] rounded-[22px] bg-white/[0.04]" />}
          {submitError && <p role="alert" className="text-[13px] text-red-400">{submitError}</p>}
          {createButton}
        </div>
      </aside>

      <TitlePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        picked={picks.map((pick) => pick.key)}
        full={picks.length >= HOST_PICKS_MAX}
        onPick={(film) => {
          setPicks((current) => (current.some((entry) => entry.key === film.key) || current.length >= HOST_PICKS_MAX ? current : [...current, film]))
          haptic(8)
        }}
      />
    </form>
  )
}
