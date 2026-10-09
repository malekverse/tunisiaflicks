"use client"
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeft, Heart, Popcorn, RotateCcw, Share2 } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import TmdbImage from '@/src/components/TmdbImage'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { cn } from '@/src/lib/utils'
import { forgetRoom, getCredentials, getSavedName, saveCredentials, saveName, type SwipeCredentials } from './storage'
import type { SwipeCard } from '@/src/lib/swipe'
import MatchMoment from './MatchMoment'
import PosterFan from './PosterFan'
import SwipeDeck from './SwipeDeck'

type RoomState = {
  code: string
  deckSize: number
  deckId: string
  deck?: SwipeCard[]
  participants: { id: string, name: string, voted: number }[]
  match: SwipeCard | null
  favorites: { card: SwipeCard, likes: number }[]
  me: { id: string, voted: string[] } | null
  /** The movie night this room picks for ('Pick together'). */
  night?: { id: string, title: string } | null
}

const POLL_MS = 3000
const panel = 'rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07]'
const RING = 2 * Math.PI * 13

/** A person in the room: their initial inside a ring that fills as they go through the deck. */
function Person({ name, voted, total, me }: { name: string, voted: number, total: number, me: boolean }) {
  const t = useT()
  const share = total ? Math.min(1, voted / total) : 0
  return (
    <li className="flex shrink-0 items-center gap-2.5 rounded-full bg-white/[0.06] py-1 pe-3.5 ps-1 lg:rounded-[14px] lg:bg-transparent lg:px-2 lg:py-1.5">
      <span className="relative grid h-8 w-8 shrink-0 place-items-center">
        <svg aria-hidden viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
          <circle cx="16" cy="16" r="13" fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="2.5" />
          <circle
            cx="16" cy="16" r="13" fill="none" strokeWidth="2.5" strokeLinecap="round"
            stroke={me ? 'rgb(255 36 20)' : 'rgb(255 255 255 / 0.85)'}
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - share)}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.23, 1, 0.32, 1)' }}
          />
        </svg>
        <span aria-hidden className="text-[12px] font-semibold uppercase text-white">{Array.from(name.trim())[0] ?? '?'}</span>
      </span>
      <span className="flex min-w-0 items-baseline gap-x-2 lg:flex-1">
        <span className="max-w-[12ch] truncate text-sm font-medium text-white lg:max-w-none"><bdi>{name}</bdi></span>
        {me && <span className="text-[12px] text-white/50">{t('nav.you')}</span>}
      </span>
      <span className="text-[12px] tabular-nums text-white/50">{voted}/{total}</span>
    </li>
  )
}

function Loading() {
  const t = useT()
  return (
    <div className="page-top pb-10" aria-busy="true">
      <div className="page-x">
        <div className="mx-auto max-w-[380px] space-y-6">
          <div className="h-12 w-40 rounded-full bg-white/[0.05]" />
          <div className="tf-shimmer relative mx-auto aspect-[2/3] w-full rounded-[22px]" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      </div>
    </div>
  )
}

export default function SwipeRoom({ code }: { code: string }) {
  const t = useT()
  const ids = useId()
  const [state, setState] = useState<RoomState | null>(null)
  const [missing, setMissing] = useState(false)
  const [credentials, setCredentials] = useState<SwipeCredentials | null | undefined>(undefined)
  const [voted, setVoted] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedMatch, setDismissedMatch] = useState<string | null>(null)
  const deckId = useRef('')
  const deck = useRef<SwipeCard[]>([])

  const load = useCallback(async (withDeck: boolean, creds: SwipeCredentials | null) => {
    const response = await fetch(`/api/swipe/${code}${withDeck ? '?deck=1' : ''}`, {
      headers: creds ? { 'x-swipe-id': creds.id, 'x-swipe-secret': creds.secret } : {},
      cache: 'no-store',
    })
    if (response.status === 404) {
      forgetRoom(code)
      return setMissing(true)
    }
    if (!response.ok) return
    const data: RoomState = await response.json()
    if (data.deck) {
      deck.current = data.deck
      deckId.current = data.deckId
      setVoted(new Set(data.me?.voted ?? []))
    } else if (data.deckId !== deckId.current) {
      // Someone dealt a new deck: fetch the cards.
      return load(true, creds)
    }
    setState({ ...data, deck: deck.current })
  }, [code])

  useEffect(() => {
    const creds = getCredentials(code)
    setCredentials(creds)
    setName(getSavedName())
    load(true, creds)
  }, [code, load])

  // Live updates (others joining, progress, the match) while the tab is visible.
  const hasMatch = !!state?.match
  useEffect(() => {
    if (missing || credentials === undefined) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(false, credentials).catch(() => {})
    }, hasMatch ? POLL_MS * 3 : POLL_MS)
    return () => clearInterval(timer)
  }, [missing, credentials, hasMatch, load])

  const joined = !!(credentials && state?.me)
  const remaining = useMemo(() => (state?.deck ?? []).filter((card) => !voted.has(card.key)), [state?.deck, voted])

  const join = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError(t('swipe.nameRequired'))
    setJoining(true)
    try {
      const response = await fetch(`/api/swipe/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', name }) })
      const data = await response.json().catch(() => ({}))
      if (response.status === 409) return setError(t('swipe.full'))
      if (!response.ok) return setError(response.status === 429 ? t('auth.tooManyAttempts') : t('swipe.joinFailed'))
      saveName(name.trim())
      saveCredentials(code, data.participant)
      setCredentials(data.participant)
      await load(true, data.participant)
    } catch {
      setError(t('swipe.joinFailed'))
    } finally {
      setJoining(false)
    }
  }

  const castVote = useCallback(async (card: SwipeCard, yes: boolean) => {
    if (!credentials) return
    setVoted((current) => new Set(current).add(card.key))
    try {
      const response = await fetch(`/api/swipe/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', id: credentials.id, secret: credentials.secret, card: card.key, yes }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(response.status))
      if (data.match) load(false, credentials)
    } catch {
      // Put the card back so the vote can be cast again.
      setVoted((current) => { const next = new Set(current); next.delete(card.key); return next })
      toast({ title: t('swipe.voteFailed'), variant: 'destructive', duration: 3000 })
    }
  }, [code, credentials, load, t])

  const newDeck = async () => {
    if (!credentials) return
    const response = await fetch(`/api/swipe/${code}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'new-deck', id: credentials.id, secret: credentials.secret }),
    })
    if (!response.ok) return toast({ title: t('swipe.createFailed'), variant: 'destructive' })
    setDismissedMatch(null)
    await load(true, credentials)
  }

  const invite = async () => {
    const url = `${window.location.origin}/swipe/${code}`
    try {
      if (navigator.share) await navigator.share({ title: t('swipe.title'), text: t('swipe.inviteText'), url })
      else {
        await navigator.clipboard.writeText(url)
        toast({ title: t('common.linkCopied'), duration: 2500 })
      }
    } catch { /* cancelled */ }
  }

  const closeMatch = useCallback(() => setDismissedMatch(state?.match?.key ?? null), [state?.match?.key])

  if (missing) {
    return (
      <div className="page-top pb-10">
        <div className="page-x">
          <div className="mx-auto flex max-w-md flex-col items-center py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-white/55">
              <Popcorn aria-hidden className="h-6 w-6" />
            </span>
            <h1 className="mt-5 font-display text-[clamp(30px,5vw,44px)] font-extrabold leading-[0.95]">{t('swipe.notFound')}</h1>
            <p className="mt-3 max-w-sm text-[15px] text-white/60">{t('swipe.notFoundText')}</p>
            <Button asChild size="lg" className="mt-7"><Link href="/swipe">{t('swipe.create')}</Link></Button>
          </div>
        </div>
      </div>
    )
  }

  if (!state || credentials === undefined) return <Loading />

  const names = state.participants.map((person) => person.name).join(', ')
  const others = state.participants.filter((person) => person.id !== state.me?.id)
  const showMatch = !!state.match && dismissedMatch !== state.match.key

  return (
    <div className="page-top pb-10">
      <div className="page-x">
        <div className="mx-auto max-w-[1080px] lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
          {/* The room: its code, the invite, and everyone's progress through the deck. */}
          <aside className="lg:sticky lg:top-[calc(var(--topbar)+28px)] lg:self-start lg:pt-6">
            {state.night && (
              <div className="mb-5 lg:mb-7">
                <Link href={`/movie-night/${state.night.id}`} className="-ms-1 inline-flex min-h-11 items-center gap-1 rounded-full pe-3 ps-1 text-[14px] text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
                  <ChevronLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />{t('movieNight.swipe.back')}
                </Link>
                <p className="mt-1 text-[13px] text-white/55">{t('movieNight.swipe.pickingFor')}</p>
                <p className="mt-0.5 truncate font-display text-[22px] font-bold leading-tight text-white"><bdi>{state.night.title || t('movieNight.defaultTitle')}</bdi></p>
              </div>
            )}
            <div className="flex items-end justify-between gap-4 lg:block">
              <div className="min-w-0">
                <p className="text-[13px] text-white/50">{t('swipe.roomCode')}</p>
                <p dir="ltr" className="mt-0.5 font-display text-[34px] font-extrabold leading-none tracking-[0.12em] text-white rtl:text-right lg:text-[46px]">{code}</p>
              </div>
              <Button onClick={invite} variant="secondary" className="shrink-0 lg:mt-6 lg:h-11 lg:w-full">
                <Share2 aria-hidden className="h-4 w-4" />{t('swipe.invite')}
              </Button>
            </div>

            <ul
              aria-label={t('swipe.people')}
              className="no-scrollbar -mx-[var(--gutter)] mt-5 flex gap-2 overflow-x-auto overflow-y-hidden px-[var(--gutter)] lg:mx-0 lg:mt-8 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0"
            >
              {state.participants.map((person) => (
                <Person key={person.id} name={person.name} voted={person.voted} total={state.deckSize} me={person.id === state.me?.id} />
              ))}
            </ul>

            {joined && others.length === 0 && (
              <p className="mt-3 flex items-start gap-2.5 text-[13px] leading-relaxed text-white/55 lg:mt-5 lg:px-2">
                <span aria-hidden className="relative mt-[7px] flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-red-500" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                {t('swipe.waiting')}
              </p>
            )}
          </aside>

          <section aria-label={t('swipe.title')} className="min-w-0">
            {!joined ? (
              <form onSubmit={join} noValidate className="mx-auto mt-8 flex max-w-[420px] flex-col items-center text-center lg:mt-4">
                <PosterFan posters={(state.deck ?? []).slice(0, 3).map((card) => card.poster_path)} sizes="(min-width: 1024px) 220px, 160px" priority className="w-[min(72%,300px)]" />
                <h1 className="mt-8 text-balance font-display text-[clamp(30px,5vw,48px)] font-extrabold leading-[0.95]">
                  {t('swipe.joinRoom', { names })}
                </h1>
                <p className="mt-3 text-[15px] text-white/60">{t('swipe.inviteText')}</p>
                <div className={cn(panel, 'mt-7 w-full space-y-4 p-5 text-start sm:p-6')}>
                  <div className="space-y-2">
                    <Label htmlFor={`${ids}-name`} className="text-[13px] font-normal text-white/70">{t('swipe.yourName')}</Label>
                    <Input
                      id={`${ids}-name`}
                      value={name}
                      maxLength={24}
                      onChange={(event) => { setName(event.target.value); if (error) setError(null) }}
                      autoComplete="nickname"
                      enterKeyHint="go"
                      aria-invalid={!!error}
                      aria-describedby={error ? `${ids}-error` : undefined}
                    />
                    {error && <p id={`${ids}-error`} role="alert" className="text-[13px] text-red-400">{error}</p>}
                  </div>
                  <Button type="submit" size="lg" disabled={joining} className="w-full">{t('swipe.join')}</Button>
                </div>
              </form>
            ) : remaining.length > 0 ? (
              <div className="relative">
                {state.match && !showMatch && (
                  <div className="absolute inset-x-0 top-0 z-40 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setDismissedMatch(null)}
                      className="pressable glass inline-flex h-10 items-center gap-2 rounded-full pe-4 ps-3 text-sm font-medium text-white"
                    >
                      <Heart aria-hidden className="h-4 w-4 fill-red-500 text-red-500" />{t('swipe.seeMatch')}
                    </button>
                  </div>
                )}
                <SwipeDeck cards={remaining} total={state.deckSize} onVote={castVote} />
              </div>
            ) : (
              <div className={cn(panel, 'mx-auto mt-8 max-w-[520px] p-6 text-center sm:p-8 lg:mt-6')}>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-white/60">
                  <Popcorn aria-hidden className="h-6 w-6" />
                </span>
                <h2 className="mt-4 font-display text-[26px] font-bold leading-tight">{t('swipe.outOfCards')}</h2>
                {!state.match && <p className="mx-auto mt-2 max-w-[40ch] text-sm text-white/60">{t('swipe.outOfCardsText')}</p>}

                {state.match && (
                  <Button type="button" variant="white" className="mt-5" onClick={() => setDismissedMatch(null)}>
                    <Heart aria-hidden className="h-4 w-4 fill-red-600 text-red-600" />{t('swipe.seeMatch')}
                  </Button>
                )}

                {state.favorites.length > 0 && (
                  <div className="mt-7 text-start">
                    <h3 className="px-2 text-[13px] text-white/55">{t('swipe.closest')}</h3>
                    <ul className="mt-2 space-y-1">
                      {state.favorites.map(({ card, likes }) => (
                        <li key={card.key}>
                          <Link href={`/${card.media_type}/${card.id}`} className="flex items-center gap-3 rounded-[14px] p-2 transition-colors hover:bg-white/[0.06]">
                            <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-[8px] bg-white/[0.06]">
                              <TmdbImage kind="poster" path={card.poster_path} fill sizes="44px" alt="" className="object-cover" />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium text-white"><bdi>{card.title}</bdi></span>
                            <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-white/70">
                              <Heart aria-hidden className="h-4 w-4 fill-red-500 text-red-500" />{likes}/{state.participants.length}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button onClick={newDeck} variant="secondary" size="lg" className="mt-7">
                  <RotateCcw aria-hidden className="h-4 w-4" />{t('swipe.newDeck')}
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showMatch && state.match && (
          <MatchMoment key={state.match.key} card={state.match} names={names} onNewDeck={newDeck} onClose={closeMatch} night={state.night ?? null} />
        )}
      </AnimatePresence>
    </div>
  )
}
