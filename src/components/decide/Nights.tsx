"use client"
// The room's memory on /decide: "How was it?" once a saved night has had time to be watched (each
// person says loved it, it was OK, or not for me), and "Your nights": what the nights say (films
// watched together, whose picks win, who has the best taste, how you like to decide) and every
// night, newest first. All of it stays on this phone (./storage, lib/decide-nights).
import React, { useId, useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Crown, Flame, Frown, Meh, PartyPopper, Smile, Sparkles, Trash2, Trophy, X } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { useI18n } from '@/src/components/I18nProvider'
import { FEELINGS, feelingCounts, nightStats, type Feeling, type Night, type NightFilm } from '@/src/lib/decide-nights'
import type { Method } from '@/src/lib/decide'
import { haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { Poster } from './parts'

const FEELING_ICON: Record<Feeling, React.ElementType> = { up: Smile, meh: Meh, down: Frown }
const FEELING_LABEL: Record<Feeling, 'decide.nights.up' | 'decide.nights.meh' | 'decide.nights.down'> = {
  up: 'decide.nights.up', meh: 'decide.nights.meh', down: 'decide.nights.down',
}
const METHOD_NAME: Record<Method, 'decide.wheel.name' | 'decide.vote.name' | 'decide.knockout.name' | 'decide.duel.name' | 'decide.chooser.name'> = {
  wheel: 'decide.wheel.name', vote: 'decide.vote.name', knockout: 'decide.knockout.name', duel: 'decide.duel.name', chooser: 'decide.chooser.name',
}

const asPick = (film: NightFilm) => ({ ...film, backdrop_path: null, by: null })

/** Loved it / it was OK / not for me, for each person in the room (or the room as one). */
export function FeelingsForm({ night, submitLabel, onSubmit, onCancel, cancelLabel }: {
  night: Night
  submitLabel: string
  onSubmit: (feelings: Record<string, Feeling>) => void
  onCancel?: () => void
  cancelLabel?: string
}) {
  const { t } = useI18n()
  const id = useId()
  const names = night.people.length ? night.people : ['']
  const [feelings, setFeelings] = useState<Record<string, Feeling>>(night.feelings ?? {})
  const any = Object.keys(feelings).length > 0
  return (
    <div>
      <ul className="space-y-2">
        {names.map((name, index) => (
          <li key={name || 'room'} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="min-w-0">
              <span id={`${id}-${index}`} className="block truncate text-[15px] font-medium text-white">{name ? <bdi dir="auto">{name}</bdi> : t('decide.nights.room')}</span>
              <span aria-hidden className="block h-[18px] text-[12.5px] text-white/55">{feelings[name] ? t(FEELING_LABEL[feelings[name]]) : ''}</span>
            </span>
            <span role="radiogroup" aria-labelledby={`${id}-${index}`} className="flex gap-1.5">
              {FEELINGS.map((feeling) => {
                const Icon = FEELING_ICON[feeling]
                const active = feelings[name] === feeling
                return (
                  <button
                    key={feeling}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t(FEELING_LABEL[feeling])}
                    title={t(FEELING_LABEL[feeling])}
                    onClick={() => { setFeelings((current) => ({ ...current, [name]: feeling })); haptic(6) }}
                    className={cn(
                      'pressable grid h-11 w-11 place-items-center rounded-full outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-red-500',
                      active
                        ? feeling === 'up' ? 'bg-emerald-400 text-black ring-emerald-400' : feeling === 'meh' ? 'bg-white text-black ring-white' : 'bg-red-600 text-white ring-red-600'
                        : 'bg-white/[0.05] text-white/70 ring-white/10 hover:text-white',
                    )}
                  >
                    <Icon aria-hidden className="h-5 w-5" />
                  </button>
                )
              })}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>}
        <Button type="button" disabled={!any} onClick={() => onSubmit(feelings)}>{submitLabel}</Button>
      </div>
    </div>
  )
}

function Films({ night, size = 'sm' }: { night: Night, size?: 'sm' | 'lg' }) {
  return (
    <span className="flex shrink-0 [&>*+*]:-ms-5">
      {night.films.map((film, index) => (
        <Poster
          key={film.key}
          pick={asPick(film)}
          sizes={size === 'lg' ? '96px' : '56px'}
          className={cn(size === 'lg' ? 'w-[84px] sm:w-[96px]' : 'w-[52px]', 'shadow-[0_10px_30px_-10px_rgb(0_0_0/0.9)] ring-2 ring-black', index > 0 && 'rotate-[4deg]')}
        />
      ))}
    </span>
  )
}

const titlesOf = (night: Night) => night.films.map((film) => film.title).join(', ')

/** The question, on top of /decide once a saved night has had time to be watched. */
export function RatePrompt({ night, onRate, onSkip }: { night: Night, onRate: (feelings: Record<string, Feeling>) => void, onSkip: () => void }) {
  const { t } = useI18n()
  return (
    <m.section
      aria-labelledby="rate-night"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: tween.fast }}
      transition={tween.slow}
      className="rounded-[22px] bg-white/[0.05] p-5 ring-1 ring-inset ring-white/[0.08] sm:p-6"
    >
      <div className="flex items-start gap-4">
        <Films night={night} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id="rate-night" className="font-display text-[22px] font-bold leading-tight text-white sm:text-[26px]">
            {night.films.length === 1 ? t('decide.nights.askOne', { title: night.films[0].title }) : t('decide.nights.askMany')}
          </h2>
          <p className="mt-1 text-[13.5px] text-white/60">{t('decide.nights.askText')}</p>
        </div>
      </div>
      <div className="mt-5">
        <FeelingsForm night={night} submitLabel={t('decide.nights.send')} onSubmit={onRate} onCancel={onSkip} cancelLabel={t('decide.nights.notNow')} />
      </div>
    </m.section>
  )
}

function Stat({ icon: Icon, value, label, note }: { icon: React.ElementType, value: React.ReactNode, label: string, note?: string }) {
  return (
    <div className="min-w-0 rounded-[18px] bg-white/[0.05] p-4">
      <Icon aria-hidden className="h-5 w-5 text-red-500" />
      <p className="mt-3 truncate font-display text-[24px] font-extrabold leading-none text-white">{value}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-white/60">{label}</p>
      {note && <p className="mt-0.5 text-[12.5px] text-white/50">{note}</p>}
    </div>
  )
}

const SHOWN = 6

export function NightsSection({ nights, onRate, onRemove, onClear }: {
  nights: Night[]
  onRate: (id: string, feelings: Record<string, Feeling>) => void
  onRemove: (id: string) => void
  onClear: () => void
}) {
  const { t, dateLocale } = useI18n()
  const stats = useMemo(() => nightStats(nights), [nights])
  const [all, setAll] = useState(false)
  const [rating, setRating] = useState<Night | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  if (!nights.length) return null
  const shown = all ? nights : nights.slice(0, SHOWN)

  const remove = (id: string) => {
    if (armed !== id) {
      setArmed(id)
      setTimeout(() => setArmed((current) => (current === id ? null : current)), 3500)
      return
    }
    setArmed(null)
    if (id === '*') onClear()
    else onRemove(id)
  }

  return (
    <section aria-labelledby="decide-nights" className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="decide-nights" className="font-display text-[21px] font-bold leading-tight sm:text-[24px]">{t('decide.nights.title')}</h2>
        <p className="text-[13px] text-white/55">{t('decide.nights.private')}</p>
      </div>

      {stats.streak && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600/15 px-3.5 py-1.5 text-[13.5px] font-medium text-white ring-1 ring-inset ring-red-500/30">
          <Flame aria-hidden className="h-4 w-4 text-red-500" />
          {t('decide.nights.streak', { name: stats.streak.name, count: stats.streak.nights })}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat icon={PartyPopper} value={stats.films} label={t('decide.nights.films')} note={t('decide.nights.nightsCount', { count: stats.nights })} />
        {stats.topPicker && <Stat icon={Trophy} value={<bdi dir="auto">{stats.topPicker.name}</bdi>} label={t('decide.nights.topPicker')} note={t('decide.nights.wins', { count: stats.topPicker.wins })} />}
        {stats.bestTaste && <Stat icon={Sparkles} value={<bdi dir="auto">{stats.bestTaste.name}</bdi>} label={t('decide.nights.bestTaste')} note={t('decide.nights.liked', { percent: stats.bestTaste.liked })} />}
        {stats.method && <Stat icon={Crown} value={t(METHOD_NAME[stats.method.method])} label={t('decide.nights.method')} note={t('decide.nights.nightsCount', { count: stats.method.nights })} />}
      </div>

      <ol className="mt-5 space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((night) => {
            const counts = feelingCounts(night)
            const owner = night.films.find((film) => film.by)?.by ?? null
            const date = new Date(night.at).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })
            return (
              <m.li key={night.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring.ui}
                className="flex items-center gap-3.5 rounded-[18px] bg-white/[0.04] p-2.5 pe-2"
              >
                <Films night={night} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-white"><bdi dir="auto">{titlesOf(night)}</bdi></p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-white/55">
                    <span>{date}</span>
                    <span>{t(METHOD_NAME[night.method])}</span>
                    {night.chooser
                      ? <span>{t('decide.winner.chosenBy', { name: night.chooser })}</span>
                      : owner && <span>{t('decide.winner.by', { name: owner })}</span>}
                  </p>
                  {night.feelings ? (
                    <p className="mt-1 flex gap-3 text-[13px] text-white/75">
                      {FEELINGS.filter((feeling) => counts[feeling] > 0).map((feeling) => {
                        const Icon = FEELING_ICON[feeling]
                        return (
                          <span key={feeling} className="inline-flex items-center gap-1" title={t(FEELING_LABEL[feeling])}>
                            <Icon aria-hidden className={cn('h-4 w-4', feeling === 'up' ? 'text-emerald-300' : feeling === 'down' ? 'text-red-400' : 'text-white/70')} />
                            <span className="sr-only">{t(FEELING_LABEL[feeling])}:</span>{counts[feeling]}
                          </span>
                        )
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="sm" variant={night.feelings ? 'ghost' : 'secondary'} onClick={() => setRating(night)}>
                    {night.feelings ? t('decide.nights.change') : t('decide.nights.rate')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => remove(night.id)}
                    aria-label={armed === night.id ? t('decide.nights.removeSure') : t('decide.nights.remove', { title: titlesOf(night) })}
                    title={armed === night.id ? t('decide.nights.removeSure') : undefined}
                    className={cn('pressable grid h-10 w-10 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500', armed === night.id ? 'bg-red-600 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white')}
                  >
                    {armed === night.id ? <Trash2 aria-hidden className="h-4 w-4" /> : <X aria-hidden className="h-4 w-4" />}
                  </button>
                </div>
              </m.li>
            )
          })}
        </AnimatePresence>
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {nights.length > SHOWN ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll((value) => !value)}>
            {all ? t('decide.nights.fewer') : t('decide.nights.all', { count: nights.length })}
          </Button>
        ) : <span />}
        <Button type="button" variant={armed === '*' ? 'destructive' : 'ghost'} size="sm" onClick={() => remove('*')}>
          <Trash2 aria-hidden className="h-4 w-4" />{armed === '*' ? t('decide.nights.clearSure') : t('decide.nights.clear')}
        </Button>
      </div>

      <Dialog open={!!rating} onOpenChange={(open) => { if (!open) setRating(null) }}>
        <DialogContent>
          <DialogTitle className="font-display text-[22px] font-bold">
            {rating && (rating.films.length === 1 ? t('decide.nights.askOne', { title: rating.films[0].title }) : t('decide.nights.askMany'))}
          </DialogTitle>
          <DialogDescription className="text-[13.5px] text-white/60">{t('decide.nights.askText')}</DialogDescription>
          {rating && (
            <FeelingsForm
              key={rating.id}
              night={rating}
              submitLabel={t('decide.nights.send')}
              onSubmit={(feelings) => { onRate(rating.id, feelings); setRating(null) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
