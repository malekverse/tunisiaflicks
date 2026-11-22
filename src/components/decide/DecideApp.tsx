"use client"
// /decide: friends in the same room settle on tonight's film from one phone. Everyone's name, then
// everyone's picks (any film or series, from search, their list or what's trending), then one of
// five ways to decide, played full screen: the wheel, a vote, a knockout, duels, or luck naming
// who gets to choose. All of it lives in this browser (./storage); only the title search and the
// trending suggestions ask the server.
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Crown, Flame, Plus, RotateCcw, ShipWheel, Swords, Trash2, UserPlus, Vote as VoteIcon, X, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import TitlePicker, { type PickedFilm } from '@/src/components/movie-night/TitlePicker'
import { getTrendingSuggestions } from '@/src/app/search/actions'
import { COUNT_MAX, PEOPLE_MAX, PICKS_MAX, cleanName, sameName, shuffle, type Method, type Pick } from '@/src/lib/decide'
import { haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { Avatar, Poster, Segmented, Stage } from './parts'
import { EMPTY_STATE, PERSON_COLORS, loadState, newId, saveState, type DecidePerson, type DecideState } from './storage'
import Wheel from './Wheel'
import Vote from './Vote'
import Knockout from './Knockout'
import Duel from './Duel'
import Chooser from './Chooser'
import Winners from './Winners'

const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6'

const METHOD_INFO: Record<Method, { icon: LucideIcon, name: string, desc: string }> = {
  wheel: { icon: ShipWheel, name: 'decide.wheel.name', desc: 'decide.wheel.desc' },
  vote: { icon: VoteIcon, name: 'decide.vote.name', desc: 'decide.vote.desc' },
  knockout: { icon: XCircle, name: 'decide.knockout.name', desc: 'decide.knockout.desc' },
  duel: { icon: Swords, name: 'decide.duel.name', desc: 'decide.duel.desc' },
  chooser: { icon: Crown, name: 'decide.chooser.name', desc: 'decide.chooser.desc' },
}
const METHOD_ORDER: Method[] = ['wheel', 'vote', 'knockout', 'duel', 'chooser']

type Result = { picks: Pick[], chooser: DecidePerson | null }
type Session = { id: number, method: Method, result: Result | null }

const fromFilm = (film: PickedFilm, by: string | null): Pick => ({
  key: film.key,
  media_type: film.media.media_type,
  id: String(film.media.id),
  title: film.media.title,
  poster_path: film.media.poster_path ?? null,
  backdrop_path: null,
  year: film.year,
  by,
})

const fromTrending = (item: any): Pick | null => {
  const media_type = item?.media_type === 'tv' ? 'tv' : item?.media_type === 'movie' ? 'movie' : null
  const id = item?.id !== undefined ? String(item.id) : ''
  const title = String(item?.title || item?.name || '').trim()
  if (!media_type || !/^\d{1,9}$/.test(id) || !title) return null
  return {
    key: `${media_type}:${id}`, media_type, id, title,
    poster_path: item.poster_path ?? null, backdrop_path: item.backdrop_path ?? null,
    year: String(item.year || item.release_date || item.first_air_date || '').slice(0, 4), by: null,
  }
}

export default function DecideApp() {
  const { t } = useI18n()
  const ids = useId()
  const [state, setState] = useState<DecideState>(EMPTY_STATE)
  const [ready, setReady] = useState(false)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [trendingBusy, setTrendingBusy] = useState(false)
  const [trendingError, setTrendingError] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const sessionCount = useRef(0)
  const howRef = useRef<HTMLElement>(null)
  const picksRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setState(loadState())
    setReady(true)
  }, [])
  useEffect(() => { if (ready) saveState(state) }, [ready, state])
  useEffect(() => {
    if (!clearArmed) return
    const timer = setTimeout(() => setClearArmed(false), 3500)
    return () => clearTimeout(timer)
  }, [clearArmed])

  const update = useCallback((change: (current: DecideState) => DecideState) => setState(change), [])
  const { people, picks, owner, count } = state
  const ownerPerson = people.find((person) => person.id === owner) ?? null
  const personOf = (pick: Pick) => people.find((person) => person.id === pick.by) ?? null

  // ---- people ----
  const addPerson = (event: React.FormEvent) => {
    event.preventDefault()
    const clean = cleanName(name)
    if (!clean) return
    if (people.length >= PEOPLE_MAX) return setNameError(t('decide.people.full', { max: PEOPLE_MAX }))
    if (people.some((person) => sameName(person.name, clean))) return setNameError(t('decide.people.taken', { name: clean }))
    const used = new Set(people.map((person) => person.color))
    const color = Array.from({ length: PERSON_COLORS.length }, (_, index) => index).find((index) => !used.has(index)) ?? people.length % PERSON_COLORS.length
    const person: DecidePerson = { id: newId(), name: clean, color }
    update((current) => ({ ...current, people: [...current.people, person], owner: current.owner ?? (current.people.length === 0 ? person.id : current.owner) }))
    setName('')
    setNameError(null)
    haptic(8)
  }
  const removePerson = (id: string) => update((current) => ({
    ...current,
    people: current.people.filter((person) => person.id !== id),
    picks: current.picks.map((pick) => (pick.by === id ? { ...pick, by: null } : pick)),
    owner: current.owner === id ? null : current.owner,
  }))

  // ---- picks ----
  const addPick = (pick: Pick) => update((current) => (
    current.picks.length >= PICKS_MAX || current.picks.some((item) => item.key === pick.key) ? current : { ...current, picks: [...current.picks, pick] }
  ))
  const removePick = (key: string) => update((current) => ({ ...current, picks: current.picks.filter((pick) => pick.key !== key) }))
  const addTrending = async () => {
    setTrendingBusy(true)
    setTrendingError(false)
    try {
      const items = (await getTrendingSuggestions()).map(fromTrending).filter((pick): pick is Pick => !!pick)
      const fresh = shuffle(items.filter((item) => !picks.some((pick) => pick.key === item.key)).slice(0, 20)).slice(0, Math.min(3, PICKS_MAX - picks.length))
      if (!fresh.length) throw new Error('nothing new')
      update((current) => ({ ...current, picks: [...current.picks, ...fresh.filter((item) => !current.picks.some((pick) => pick.key === item.key))].slice(0, PICKS_MAX) }))
      haptic(8)
    } catch {
      setTrendingError(true)
    } finally {
      setTrendingBusy(false)
    }
  }
  const clearAll = () => {
    if (!clearArmed) return setClearArmed(true)
    setClearArmed(false)
    update((current) => ({ ...EMPTY_STATE, fair: current.fair, voteMode: current.voteMode, lastChooser: current.lastChooser }))
  }

  // ---- deciding ----
  const need = (method: Method): string | null => {
    if (method === 'chooser') return people.length >= 2 ? null : t('decide.how.needPeople', { count: 2 })
    const minimum = method === 'duel' ? 2 : Math.max(2, count + 1)
    return picks.length >= minimum ? null : t('decide.how.needPicks', { count: minimum })
  }
  const open = (method: Method) => {
    if (need(method)) return
    sessionCount.current += 1
    setSession({ id: sessionCount.current, method, result: null })
    haptic(10)
  }
  const close = useCallback(() => setSession(null), [])
  const finish = (keys: string[]) => {
    const won = keys.map((key) => picks.find((pick) => pick.key === key)).filter((pick): pick is Pick => !!pick)
    setSession((current) => (current ? { ...current, result: { picks: won, chooser: null } } : current))
  }
  const chosen = (pick: Pick, chooser: DecidePerson) => {
    addPick(pick)
    update((current) => ({ ...current, lastChooser: chooser.name }))
    setSession((current) => (current ? { ...current, result: { picks: [pick], chooser } } : current))
  }
  const again = () => {
    setSession(null)
    setTimeout(() => howRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const back = () => {
    setSession(null)
    setTimeout(() => picksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const glow = session?.result?.picks[0]?.poster_path ?? picks.find((pick) => pick.poster_path)?.poster_path ?? null
  const pickedKeys = useMemo(() => picks.map((pick) => pick.key), [picks])

  return (
    <div className="page-top pb-16">
      <div className="page-x">
        <div className="mx-auto max-w-[1160px]">
          <header className="flex items-center gap-5 sm:gap-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-balance font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95]">{t('decide.title')}</h1>
              <p className="mt-4 max-w-[60ch] text-pretty text-[15px] leading-relaxed text-white/60">{t('decide.subtitle')}</p>
            </div>
            <DecorWheel picks={picks} />
          </header>

          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6">
            {/* Who's watching */}
            <section aria-labelledby={`${ids}-people`} className={cn(panel, 'lg:col-start-1 lg:row-start-1')}>
              <h2 id={`${ids}-people`} className="font-display text-[21px] font-bold leading-tight sm:text-[24px]">{t('decide.people.title')}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-white/55">{t('decide.people.hint')}</p>
              <form onSubmit={addPerson} noValidate className="mt-4 flex gap-2">
                <label htmlFor={`${ids}-name`} className="sr-only">{t('decide.people.placeholder')}</label>
                <input
                  id={`${ids}-name`}
                  value={name}
                  onChange={(event) => { setName(event.target.value); if (nameError) setNameError(null) }}
                  placeholder={t('decide.people.placeholder')}
                  maxLength={40}
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? `${ids}-name-error` : undefined}
                  className="h-12 min-w-0 flex-1 rounded-full bg-white/[0.07] px-5 text-[16px] text-white outline-none ring-1 ring-inset ring-white/10 placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-red-500"
                />
                <Button type="submit" size="lg" variant="secondary" disabled={!cleanName(name)} className="shrink-0 px-5">
                  <UserPlus aria-hidden className="h-5 w-5" />{t('decide.people.add')}
                </Button>
              </form>
              {nameError && <p id={`${ids}-name-error`} role="alert" className="mt-2 text-[13px] text-red-400">{nameError}</p>}
              {people.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  <AnimatePresence initial={false}>
                    {people.map((person) => (
                      <m.li key={person.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={spring.snappy}
                        className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] py-1 pe-1 ps-1"
                      >
                        <Avatar person={person} size={30} />
                        <bdi dir="auto" className="max-w-[12ch] truncate text-[14.5px] font-medium text-white">{person.name}</bdi>
                        <button type="button" onClick={() => removePerson(person.id)} aria-label={t('decide.people.remove', { name: person.name })}
                          className="grid h-8 w-8 place-items-center rounded-full text-white/55 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          <X aria-hidden className="h-4 w-4" />
                        </button>
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>

            {/* The picks */}
            <section ref={picksRef} aria-labelledby={`${ids}-picks`} className={cn(panel, 'scroll-mt-[calc(var(--topbar)+16px)] lg:col-start-2 lg:row-span-2 lg:row-start-1')}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`${ids}-picks`} className="font-display text-[21px] font-bold leading-tight sm:text-[24px]">{t('decide.picks.title')}</h2>
                <span className="shrink-0 text-[13px] tabular-nums text-white/50">{t('decide.picks.count', { count: picks.length, max: PICKS_MAX })}</span>
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-white/55">{t('decide.picks.hint')}</p>

              {people.length > 0 && (
                <div className="mt-4">
                  <p id={`${ids}-owner`} className="mb-2 text-[13px] text-white/60">{t('decide.picks.for')}</p>
                  <div role="radiogroup" aria-labelledby={`${ids}-owner`} className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {[null, ...people].map((person) => {
                      const active = (person?.id ?? null) === owner
                      return (
                        <button
                          key={person?.id ?? 'anyone'}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => update((current) => ({ ...current, owner: person?.id ?? null }))}
                          className={cn(
                            'inline-flex h-10 shrink-0 items-center gap-2 rounded-full pe-4 text-[14px] font-medium outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-red-500',
                            person ? 'ps-1' : 'ps-4',
                            active ? 'bg-white text-black ring-white' : 'bg-white/[0.05] text-white/75 ring-white/10 hover:text-white',
                          )}
                        >
                          {person && <Avatar person={person} size={30} />}
                          <bdi dir="auto" className="max-w-[12ch] truncate">{person ? person.name : t('decide.picks.anyone')}</bdi>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                <Button type="button" size="lg" className="min-w-0 sm:flex-1" onClick={() => setAdding(true)} disabled={picks.length >= PICKS_MAX}>
                  <Plus aria-hidden className="h-5 w-5" />
                  <span className="truncate">{ownerPerson ? t('decide.picks.addFor', { name: ownerPerson.name }) : t('decide.picks.add')}</span>
                </Button>
                <Button type="button" size="lg" variant="secondary" onClick={addTrending} disabled={trendingBusy || picks.length >= PICKS_MAX}>
                  <Flame aria-hidden className="h-5 w-5" />{t('decide.picks.trending')}
                </Button>
              </div>
              {trendingError && <p role="alert" className="mt-2 text-[13px] text-red-400">{t('decide.picks.trendingFailed')}</p>}
              {picks.length >= PICKS_MAX && <p className="mt-2 text-[13px] text-white/60">{t('decide.picks.full', { max: PICKS_MAX })}</p>}

              {picks.length === 0 ? (
                <div className="mt-5 grid min-h-[180px] place-items-center rounded-[18px] border border-dashed border-white/15 p-6 text-center">
                  <p className="max-w-[34ch] text-[14px] leading-relaxed text-white/55">{ready ? t('decide.picks.empty') : ''}</p>
                </div>
              ) : (
                <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-4">
                  <AnimatePresence initial={false}>
                    {picks.map((pick) => {
                      const person = personOf(pick)
                      return (
                        <m.li key={pick.key} layout initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={spring.ui} className="relative min-w-0">
                          <Poster pick={pick} sizes="(min-width: 1024px) 140px, 30vw">
                            {person && (
                              <span className="absolute bottom-1.5 start-1.5" title={t('decide.picks.by', { name: person.name })}>
                                <Avatar person={person} size={26} className="ring-2 ring-black" />
                              </span>
                            )}
                          </Poster>
                          <button
                            type="button"
                            onClick={() => removePick(pick.key)}
                            aria-label={t('decide.picks.remove', { title: pick.title })}
                            className="pressable absolute end-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white/85 outline-none ring-1 ring-white/25 backdrop-blur hover:bg-red-600 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
                          >
                            <X aria-hidden className="h-4 w-4" strokeWidth={2.4} />
                          </button>
                          <bdi dir="auto" className="mt-1.5 block truncate text-[12.5px] text-white/80">{pick.title}</bdi>
                          {person && <span className="sr-only">{t('decide.picks.by', { name: person.name })}</span>}
                        </m.li>
                      )
                    })}
                  </AnimatePresence>
                </ul>
              )}

              {(picks.length > 0 || people.length > 0) && (
                <div className="mt-5 flex justify-end">
                  <Button type="button" variant={clearArmed ? 'destructive' : 'ghost'} size="sm" onClick={clearAll}>
                    {clearArmed ? <Trash2 aria-hidden className="h-4 w-4" /> : <RotateCcw aria-hidden className="h-4 w-4" />}
                    {clearArmed ? t('decide.picks.clearSure') : t('decide.picks.clear')}
                  </Button>
                </div>
              )}
            </section>

            {/* How do we decide? (under the names on desktop, beside the picks) */}
            <section ref={howRef} aria-labelledby={`${ids}-how`} className={cn(panel, 'scroll-mt-[calc(var(--topbar)+16px)] lg:col-start-1 lg:row-start-2')}>
              <h2 id={`${ids}-how`} className="font-display text-[21px] font-bold leading-tight sm:text-[24px]">{t('decide.how.title')}</h2>
              <div className="mt-4">
                <p className="mb-2 text-[13px] text-white/60">{t('decide.how.count')}</p>
                <Segmented
                  label={t('decide.how.count')}
                  value={count}
                  onChange={(value) => update((current) => ({ ...current, count: value }))}
                  options={[
                    { value: 1, label: t('decide.how.one') },
                    { value: 2, label: t('decide.how.double') },
                    { value: COUNT_MAX, label: t('decide.how.triple') },
                  ]}
                />
              </div>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {METHOD_ORDER.map((method) => {
                  const info = METHOD_INFO[method]
                  const missing = ready ? need(method) : null
                  const oneOnly = count > 1 && (method === 'duel' || method === 'chooser')
                  const Icon = info.icon
                  return (
                    <li key={method}>
                      <button
                        type="button"
                        onClick={() => open(method)}
                        aria-disabled={!!missing}
                        aria-describedby={`${ids}-${method}-desc`}
                        className={cn(
                          'group pressable flex h-full w-full items-start gap-3.5 rounded-[18px] p-4 text-start outline-none ring-1 ring-inset transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-red-500',
                          missing ? 'cursor-not-allowed bg-white/[0.02] ring-white/[0.05]' : 'bg-white/[0.06] ring-white/[0.08] hover:bg-white/[0.1]',
                        )}
                      >
                        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors', missing ? 'bg-white/[0.05] text-white/35' : 'bg-red-600 text-white group-hover:bg-red-500')}>
                          <Icon aria-hidden className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-[16px] font-semibold', missing ? 'text-white/50' : 'text-white')}>{t(info.name as any)}</span>
                          <span id={`${ids}-${method}-desc`} className="mt-0.5 block text-[13px] leading-snug text-white/55">
                            {missing ?? (oneOnly ? t('decide.how.oneOnly') : t(info.desc as any))}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </div>
      </div>

      <TitlePicker
        open={adding}
        onOpenChange={setAdding}
        onPick={(film) => { addPick(fromFilm(film, owner)); haptic(8) }}
        picked={pickedKeys}
        full={picks.length >= PICKS_MAX}
        heading={ownerPerson ? t('decide.picks.addFor', { name: ownerPerson.name }) : t('decide.picks.add')}
      />

      <AnimatePresence>
        {session && (
          <Stage
            key={session.id}
            title={t(METHOD_INFO[session.method].name as any)}
            onClose={close}
            glow={glow}
          >
            {session.result ? (
              <Winners picks={session.result.picks} people={people} chooser={session.result.chooser} onAgain={again} onBack={back} />
            ) : session.method === 'wheel' ? (
              <Wheel picks={picks} people={people} count={count} fair={state.fair} onFair={(fair) => update((current) => ({ ...current, fair }))} onDone={finish} />
            ) : session.method === 'vote' ? (
              <Vote picks={picks} people={people} count={count} mode={state.voteMode} onMode={(voteMode) => update((current) => ({ ...current, voteMode }))} onDone={finish} />
            ) : session.method === 'knockout' ? (
              <Knockout picks={picks} people={people} count={count} onDone={finish} />
            ) : session.method === 'duel' ? (
              <Duel picks={picks} people={people} onDone={finish} />
            ) : (
              <Chooser picks={picks} people={people} lastChooser={state.lastChooser} fair={state.fair} onFair={(fair) => update((current) => ({ ...current, fair }))} onChosen={chosen} />
            )}
          </Stage>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The little wheel by the title: the picks' posters around it once there are some. Decorative. */
function DecorWheel({ picks }: { picks: Pick[] }) {
  return (
    <m.div
      aria-hidden
      initial={{ rotate: -30, opacity: 0 }}
      animate={{ rotate: 0, opacity: 1 }}
      transition={{ ...tween.slow, duration: 0.9 }}
      className="relative hidden h-[120px] w-[120px] shrink-0 sm:block lg:h-[150px] lg:w-[150px]"
    >
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(#dc2626_0_25%,#1c1c21_0_50%,#8f1414_0_75%,#2b2b31_0)] shadow-[0_20px_60px_-15px_rgb(229_15_5/0.6)] ring-4 ring-white/10" />
      <div className="absolute inset-[38%] rounded-full bg-white ring-4 ring-black" />
      <svg className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3" width="22" height="26" viewBox="0 0 34 40"><path d="M17 40 L2 8 A16 16 0 0 1 32 8 Z" fill="#fff" /></svg>
      {picks.length > 0 && <span className="absolute -bottom-1 -end-1 grid h-9 min-w-9 place-items-center rounded-full bg-white px-2 font-display text-[15px] font-bold text-black ring-4 ring-black">{picks.length}</span>}
    </m.div>
  )
}
