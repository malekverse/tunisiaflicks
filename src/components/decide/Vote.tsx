"use client"
// Vote: secret ballots (the phone goes around, a cover between people so nobody sees the others'
// votes), or a show of hands counted out loud. A yes is a point, a favourite one more; a tie at the
// top goes to the wheel, never to list order.
import React, { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, EyeOff, Hand, Minus, Plus, Star, Trophy } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { tallyBallots, tallyHands, voteResult, type Ballot, type Pick, type Tally } from '@/src/lib/decide'
import { haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { Avatar, Poster, Segmented } from './parts'
import type { DecidePerson, VoteMode } from './storage'
import Wheel from './Wheel'

type Phase = 'setup' | 'pass' | 'ballot' | 'hands' | 'results' | 'tiebreak'

export default function Vote({ picks, people, count, mode, onMode, onDone }: {
  picks: Pick[]
  people: DecidePerson[]
  count: number
  mode: VoteMode
  onMode: (mode: VoteMode) => void
  onDone: (keys: string[]) => void
}) {
  const t = useT()
  const canSecret = people.length >= 2
  const [phase, setPhase] = useState<Phase>('setup')
  const [voter, setVoter] = useState(0)
  const [ballots, setBallots] = useState<Ballot[]>([])
  const [ballot, setBallot] = useState<Ballot>({ yes: [], star: null })
  const [hands, setHands] = useState<Record<string, number>>({})
  const keys = useMemo(() => picks.map((pick) => pick.key), [picks])
  const byKey = useMemo(() => new Map(picks.map((pick) => [pick.key, pick])), [picks])
  const effectiveMode: VoteMode = canSecret ? mode : 'hands'

  const tally: Tally[] = useMemo(
    () => (effectiveMode === 'secret' ? tallyBallots(keys, ballots) : tallyHands(keys, hands)),
    [effectiveMode, keys, ballots, hands],
  )
  const result = useMemo(() => voteResult(tally, count), [tally, count])

  const start = () => {
    setBallots([])
    setHands({})
    setVoter(0)
    setPhase(effectiveMode === 'secret' ? 'pass' : 'hands')
  }

  const cast = () => {
    const next = [...ballots, ballot]
    setBallots(next)
    setBallot({ yes: [], star: null })
    haptic(14)
    if (next.length >= people.length) setPhase('results')
    else {
      setVoter(next.length)
      setPhase('pass')
    }
    window.scrollTo?.({ top: 0 })
  }

  const toggleYes = (key: string) => setBallot((current) => {
    const yes = current.yes.includes(key) ? current.yes.filter((item) => item !== key) : [...current.yes, key]
    return { yes, star: current.star === key && !yes.includes(key) ? null : current.star }
  })
  const toggleStar = (key: string) => setBallot((current) => (current.star === key
    ? { ...current, star: null }
    : { yes: current.yes.includes(key) ? current.yes : [...current.yes, key], star: key }))

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-md pt-4">
        <h3 className="font-display text-[22px] font-bold text-white">{t('decide.vote.mode')}</h3>
        <Segmented
          className="mt-4"
          label={t('decide.vote.mode')}
          value={effectiveMode}
          onChange={onMode}
          options={[
            { value: 'secret', label: t('decide.vote.secret'), disabled: !canSecret },
            { value: 'hands', label: t('decide.vote.hands') },
          ]}
        />
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          {!canSecret ? t('decide.vote.needNames') : effectiveMode === 'secret' ? t('decide.vote.secretHint') : t('decide.vote.handsHint')}
        </p>
        <Button type="button" size="lg" className="mt-7 w-full" onClick={start}>
          {effectiveMode === 'secret' ? <EyeOff aria-hidden className="h-5 w-5" /> : <Hand aria-hidden className="h-5 w-5" />}
          {t('decide.vote.start')}
        </Button>
      </div>
    )
  }

  if (phase === 'pass') {
    const person = people[voter]
    return (
      <AnimatePresence mode="wait">
        <m.div
          key={person.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={spring.ui}
          className="flex min-h-[calc(100dvh-160px)] flex-col items-center justify-center text-center"
        >
          <p className="text-[15px] text-white/60">{t('decide.vote.passTo')}</p>
          <Avatar person={person} size={88} className="mt-5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.8)]" />
          <p className="mt-4 font-display text-[clamp(36px,9vw,56px)] font-extrabold leading-none text-white"><bdi dir="auto">{person.name}</bdi></p>
          <Button type="button" size="lg" className="mt-9 px-8" onClick={() => setPhase('ballot')}>
            {t('decide.vote.ready', { name: person.name })}
          </Button>
          <Progress done={voter} total={people.length} />
        </m.div>
      </AnimatePresence>
    )
  }

  if (phase === 'ballot') {
    const person = people[voter]
    return (
      <div className="pt-2">
        <h3 className="font-display text-[clamp(22px,5vw,30px)] font-bold text-white">{t('decide.vote.ballotTitle', { name: person.name })}</h3>
        <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-white/60">{t('decide.vote.ballotHint')}</p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {picks.map((pick) => {
            const yes = ballot.yes.includes(pick.key) || ballot.star === pick.key
            const star = ballot.star === pick.key
            return (
              <li key={pick.key} className="relative">
                <button
                  type="button"
                  aria-pressed={yes}
                  aria-label={t('decide.vote.yes', { title: pick.title })}
                  onClick={() => { toggleYes(pick.key); haptic(6) }}
                  className="pressable block w-full rounded-[14px] text-start outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <Poster pick={pick} sizes="(min-width: 768px) 200px, 45vw" className={cn('transition-[box-shadow,opacity] duration-200', yes ? 'ring-[3px] ring-white' : 'opacity-75')}>
                    <span className={cn('absolute start-2 top-2 grid h-8 w-8 place-items-center rounded-full transition-colors duration-200', yes ? 'bg-white text-black' : 'bg-black/55 text-transparent ring-1 ring-white/50')}>
                      <Check aria-hidden className="h-5 w-5" strokeWidth={3} />
                    </span>
                  </Poster>
                  <bdi dir="auto" className="mt-1.5 block truncate text-[13.5px] text-white/85">{pick.title}</bdi>
                </button>
                <button
                  type="button"
                  aria-pressed={star}
                  aria-label={t('decide.vote.star', { title: pick.title })}
                  onClick={() => { toggleStar(pick.key); haptic(10) }}
                  className={cn(
                    'pressable absolute end-2 top-2 grid h-10 w-10 place-items-center rounded-full outline-none backdrop-blur transition-colors focus-visible:ring-2 focus-visible:ring-red-500',
                    star ? 'bg-amber-400 text-black' : 'bg-black/55 text-white/80 ring-1 ring-white/40 hover:text-white',
                  )}
                >
                  <Star aria-hidden className={cn('h-5 w-5', star && 'fill-current')} />
                </button>
              </li>
            )
          })}
        </ul>
        <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-6 sm:-mx-6 sm:px-6">
          <Button type="button" size="lg" className="w-full" onClick={cast}>
            <EyeOff aria-hidden className="h-5 w-5" />{t('decide.vote.cast')}
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'hands') {
    return (
      <div className="mx-auto max-w-xl pt-2">
        <h3 className="font-display text-[clamp(22px,5vw,30px)] font-bold text-white">{t('decide.vote.handsTitle')}</h3>
        <p className="mt-1.5 text-[14px] text-white/60">{t('decide.vote.handsHint')}</p>
        <ul className="mt-5 space-y-2">
          {picks.map((pick) => {
            const value = hands[pick.key] ?? 0
            const set = (next: number) => { setHands((current) => ({ ...current, [pick.key]: Math.max(0, Math.min(99, next)) })); haptic(6) }
            return (
              <li key={pick.key} className="flex items-center gap-3 rounded-[16px] bg-white/[0.05] p-2 pe-2.5">
                <Poster pick={pick} sizes="44px" className="w-11 shrink-0 rounded-[8px]" />
                <bdi dir="auto" className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">{pick.title}</bdi>
                <button type="button" onClick={() => set(value - 1)} disabled={value === 0} aria-label={t('decide.vote.less', { title: pick.title })} className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-30">
                  <Minus aria-hidden className="h-5 w-5" />
                </button>
                <span aria-live="polite" className="w-8 text-center font-display text-2xl font-bold tabular-nums text-white">{value}</span>
                <button type="button" onClick={() => set(value + 1)} aria-label={t('decide.vote.more', { title: pick.title })} className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                  <Plus aria-hidden className="h-5 w-5" />
                </button>
              </li>
            )
          })}
        </ul>
        <Button type="button" size="lg" className="mt-6 w-full" onClick={() => setPhase('results')}>{t('decide.vote.count')}</Button>
      </div>
    )
  }

  if (phase === 'tiebreak') {
    const tied = result.tied.map((key) => byKey.get(key)!).filter(Boolean)
    return (
      <div className="pt-2">
        <p className="mb-5 text-center text-[15px] text-white/70">{t('decide.vote.tieText')}</p>
        <Wheel picks={tied} people={people} count={result.open} fair={false} fairAvailable={false} onDone={(won) => onDone([...result.winners, ...won])} />
      </div>
    )
  }

  // The results: the bars fill in, best first.
  const top = Math.max(1, ...tally.map((row) => row.points))
  const inSet = new Set(result.winners)
  const tiedSet = new Set(result.tied)
  return (
    <div className="mx-auto max-w-xl pt-2">
      <h3 className="font-display text-[clamp(24px,5vw,32px)] font-bold text-white">{t('decide.vote.results')}</h3>
      <ol className="mt-5 space-y-2">
        {tally.map((row, index) => {
          const pick = byKey.get(row.key)!
          const winner = inSet.has(row.key)
          const tied = tiedSet.has(row.key)
          return (
            <m.li
              key={row.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...tween.base, delay: 0.06 * index }}
              className={cn('relative overflow-hidden rounded-[16px] bg-white/[0.04] p-2 pe-3', winner && 'ring-2 ring-white/80', tied && 'ring-2 ring-amber-400/80')}
            >
              <m.span
                aria-hidden
                initial={{ width: 0 }}
                animate={{ width: `${(row.points / top) * 100}%` }}
                transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1], delay: 0.15 + 0.06 * index }}
                className={cn('absolute inset-y-0 start-0', winner ? 'bg-red-600/45' : tied ? 'bg-amber-400/25' : 'bg-white/[0.07]')}
              />
              <span className="relative flex items-center gap-3">
                <Poster pick={pick} sizes="40px" className="w-10 shrink-0 rounded-[7px]" />
                <span className="min-w-0 flex-1">
                  <bdi dir="auto" className="block truncate text-[15px] font-semibold text-white">{pick.title}</bdi>
                  <span className="block text-[12.5px] text-white/60">
                    {t('decide.vote.yesCount', { count: row.yes })}{row.stars > 0 && ` · ${t('decide.vote.starCount', { count: row.stars })}`}
                  </span>
                </span>
                {winner && <Trophy aria-hidden className="h-5 w-5 shrink-0 text-white" />}
                <span className="w-8 shrink-0 text-end font-display text-2xl font-bold tabular-nums text-white">{row.points}</span>
              </span>
            </m.li>
          )
        })}
      </ol>

      {result.tied.length > 0 ? (
        <div className="mt-6 rounded-[18px] bg-amber-400/10 p-4 ring-1 ring-inset ring-amber-400/30">
          <p className="font-display text-[20px] font-bold text-white">{t('decide.vote.tie')}</p>
          <p className="mt-1 text-[14px] text-white/70">{t('decide.vote.tieText')}</p>
          <Button type="button" size="lg" className="mt-4 w-full" onClick={() => setPhase('tiebreak')}>{t('decide.vote.tieSpin')}</Button>
        </div>
      ) : (
        <Button type="button" size="lg" className="mt-6 w-full" onClick={() => onDone(result.winners)}>
          <Trophy aria-hidden className="h-5 w-5" />{t('decide.vote.see')}
        </Button>
      )}
    </div>
  )
}

function Progress({ done, total }: { done: number, total: number }) {
  const t = useT()
  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <div aria-hidden className="flex gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={cn('h-1.5 w-6 rounded-full', index < done ? 'bg-white' : 'bg-white/20')} />
        ))}
      </div>
      <p className="text-[13px] text-white/55">{t('decide.vote.progress', { done, total })}</p>
    </div>
  )
}
