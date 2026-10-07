"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { FaHeart, FaXmark, FaPlay, FaShareNodes, FaStar, FaRotate } from 'react-icons/fa6'
import { Button } from '@/src/components/ui/button'
import TmdbImage from '@/src/components/TmdbImage'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { getCredentials, getSavedName, saveCredentials, saveName, type SwipeCredentials } from './storage'
import type { SwipeCard } from '@/src/lib/swipe'

type RoomState = {
  code: string
  deckSize: number
  deckId: string
  deck?: SwipeCard[]
  participants: { id: string, name: string, voted: number }[]
  match: SwipeCard | null
  favorites: { card: SwipeCard, likes: number }[]
  me: { id: string, voted: string[] } | null
}

const POLL_MS = 3000
const SWIPE_THRESHOLD = 110

type SwipeControl = React.MutableRefObject<((yes: boolean) => void) | null>

function Card({ card, depth, onVote, active, control }: { card: SwipeCard, depth: number, onVote: (yes: boolean) => void, active: boolean, control: SwipeControl }) {
  const t = useT()
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState<null | boolean>(null)
  const [dragging, setDragging] = useState(false)
  const start = useRef<number | null>(null)

  const left = useRef(false)
  const finish = useCallback((yes: boolean) => {
    if (left.current) return
    left.current = true
    setLeaving(yes)
    // Let the fly-out animation play before the card is removed.
    setTimeout(() => onVote(yes), 220)
  }, [onVote])

  // The ✕ / ♥ buttons and arrow keys swipe the top card through this.
  useEffect(() => {
    if (!active) return
    control.current = finish
    return () => { if (control.current === finish) control.current = null }
  }, [active, control, finish])

  const onPointerDown = (event: React.PointerEvent) => {
    if (!active || leaving !== null) return
    start.current = event.clientX
    setDragging(true)
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent) => {
    if (start.current === null) return
    setDx(event.clientX - start.current)
  }
  const onPointerUp = () => {
    if (start.current === null) return
    start.current = null
    setDragging(false)
    if (Math.abs(dx) > SWIPE_THRESHOLD) finish(dx > 0)
    else setDx(0)
  }

  const x = leaving === null ? dx : leaving ? 700 : -700
  const style: React.CSSProperties = {
    transform: `translateX(${x}px) translateY(${depth * 10}px) scale(${1 - depth * 0.04}) rotate(${x / 18}deg)`,
    transition: dragging ? 'none' : 'transform 0.25s ease-out',
    zIndex: 10 - depth,
  }
  const yesOpacity = Math.max(0, Math.min(1, x / SWIPE_THRESHOLD))
  const noOpacity = Math.max(0, Math.min(1, -x / SWIPE_THRESHOLD))

  return (
    <div
      className={`absolute inset-0 select-none overflow-hidden rounded-3xl bg-zinc-900 shadow-2xl shadow-black/50 ${active ? 'cursor-grab active:cursor-grabbing touch-none' : 'pointer-events-none'}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden={!active}
    >
      <TmdbImage kind="poster" path={card.poster_path} fill sizes="(min-width: 640px) 360px, 90vw" alt="" draggable={false} className="object-cover pointer-events-none" priority={active} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pt-24 text-white">
        <p className="text-xs uppercase tracking-wide text-gray-300">
          {card.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}{card.year ? ` · ${card.year}` : ''}
          {card.vote_average > 0 && <span className="ms-2 inline-flex items-center gap-1 text-yellow-400"><FaStar />{card.vote_average.toFixed(1)}</span>}
        </p>
        <h2 className="mt-1 text-2xl font-bold leading-tight"><bdi>{card.title}</bdi></h2>
        {card.overview && <p className="mt-2 line-clamp-3 text-sm text-gray-300">{card.overview}</p>}
      </div>
      <span className="absolute start-5 top-6 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black uppercase text-emerald-400" style={{ opacity: yesOpacity }}>{t('swipe.yes')}</span>
      <span className="absolute end-5 top-6 rotate-12 rounded-lg border-4 border-red-500 px-3 py-1 text-2xl font-black uppercase text-red-500" style={{ opacity: noOpacity }}>{t('swipe.no')}</span>
    </div>
  )
}

function MatchScreen({ card, names, onNewDeck, onClose }: { card: SwipeCard, names: string, onNewDeck: () => void, onClose: () => void }) {
  const t = useT()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const href = `/${card.media_type}/${card.id}`
  return (
    <div role="dialog" aria-modal="true" aria-label={t('swipe.matchTitle')} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-300">
      <button type="button" onClick={onClose} aria-label={t('common.close')} className="absolute end-4 top-4 rounded-full p-2 text-2xl text-white/70 hover:bg-white/10 hover:text-white"><FaXmark /></button>
      <div className="w-full max-w-sm text-center text-white animate-in zoom-in-90 duration-500">
        <p className="text-5xl" aria-hidden>🎉</p>
        <h2 className="mt-2 bg-gradient-to-r from-red-400 via-pink-400 to-amber-300 bg-clip-text text-4xl font-black text-transparent">{t('swipe.matchTitle')}</h2>
        <p className="mt-1 text-sm text-gray-300">{t('swipe.matchText', { names })}</p>
        <div className="relative mx-auto mt-5 aspect-[2/3] w-48 overflow-hidden rounded-2xl shadow-2xl shadow-red-500/30 ring-4 ring-red-500">
          <TmdbImage kind="poster" path={card.poster_path} fill sizes="192px" alt={card.title} className="object-cover" />
        </div>
        <p className="mt-3 text-xl font-bold"><bdi>{card.title}</bdi></p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-red-500 text-white hover:bg-red-400"><Link href={`${href}#streamSection`}><FaPlay className="me-2" />{t('hero.watchNow')}</Link></Button>
          <Button asChild variant="outline" className="border-white bg-transparent text-white hover:bg-white/10 hover:text-white"><Link href={href}>{t('pick.moreInfo')}</Link></Button>
        </div>
        <button type="button" onClick={onNewDeck} className="mt-4 text-sm text-gray-400 underline-offset-4 hover:text-white hover:underline">{t('swipe.playAgain')}</button>
      </div>
    </div>
  )
}

export default function SwipeRoom({ code }: { code: string }) {
  const t = useT()
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
    if (response.status === 404) return setMissing(true)
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

  const top = remaining[0]
  const control: SwipeControl = useRef(null)
  const swipeTop = useCallback((yes: boolean) => control.current?.(yes), [])

  useEffect(() => {
    if (!joined || !top) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, textarea, select')) return
      if (event.key === 'ArrowRight') swipeTop(true)
      if (event.key === 'ArrowLeft') swipeTop(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [joined, top, swipeTop])

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

  if (missing) {
    return (
      <div className="w-full max-w-md px-4 py-16 text-center space-y-4">
        <p className="text-5xl" aria-hidden>🍿</p>
        <h1 className="text-2xl font-bold">{t('swipe.notFound')}</h1>
        <p className="text-gray-500">{t('swipe.notFoundText')}</p>
        <Button asChild className="bg-red-500 text-white hover:bg-red-400"><Link href="/swipe">{t('swipe.create')}</Link></Button>
      </div>
    )
  }

  if (!state || credentials === undefined) {
    return <div className="w-full max-w-md px-4 py-24 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500" /></div>
  }

  const names = state.participants.map((person) => person.name).join(', ')
  const others = state.participants.filter((person) => person.id !== state.me?.id)

  return (
    <div className="w-full max-w-md px-4 pb-10 space-y-5">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">{t('swipe.roomCode')}</p>
          <p className="text-3xl font-black tracking-[0.25em]" dir="ltr">{code}</p>
        </div>
        <Button onClick={invite} variant="outline" className="gap-2"><FaShareNodes />{t('swipe.invite')}</Button>
      </header>

      <ul className="flex flex-wrap gap-2" aria-label={t('swipe.people')}>
        {state.participants.map((person) => (
          <li key={person.id} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${person.id === state.me?.id ? 'bg-red-500/15 text-red-600 dark:text-red-300' : 'bg-gray-100 dark:bg-zinc-800'}`}>
            <span className="font-medium"><bdi>{person.name}</bdi></span>
            <span className="text-xs opacity-70 tabular-nums">{person.voted}/{state.deckSize}</span>
          </li>
        ))}
      </ul>

      {!joined ? (
        <form onSubmit={join} className="rounded-2xl border border-gray-200 p-5 space-y-4 dark:border-zinc-800">
          <h1 className="text-xl font-semibold">{t('swipe.joinRoom', { names })}</h1>
          <label className="block space-y-1 text-sm">
            <span>{t('swipe.yourName')}</span>
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoComplete="nickname"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-zinc-700 dark:bg-[#1a161f] dark:text-white" />
          </label>
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={joining} className="w-full bg-red-500 text-white hover:bg-red-400">{t('swipe.join')}</Button>
        </form>
      ) : (
        <>
          {others.length === 0 && (
            <p className="rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">{t('swipe.waiting')}</p>
          )}

          {top ? (
            <>
              <div className="relative mx-auto aspect-[2/3] w-full max-w-[360px]">
                {remaining.slice(0, 3).reverse().map((card) => {
                  const depth = remaining.indexOf(card)
                  return <Card key={card.key} card={card} depth={depth} active={depth === 0} control={control} onVote={(yes) => castVote(card, yes)} />
                })}
              </div>
              {/* Same physical direction as the swipe in every language. */}
              <div className="flex items-center justify-center gap-6" dir="ltr">
                <button type="button" onClick={() => swipeTop(false)} aria-label={t('swipe.no')}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-300 text-3xl text-gray-500 transition hover:scale-110 hover:border-red-500 hover:text-red-500 dark:border-zinc-700">
                  <FaXmark />
                </button>
                <span className="text-sm text-gray-500 tabular-nums">{state.deckSize - remaining.length + 1}/{state.deckSize}</span>
                <button type="button" onClick={() => swipeTop(true)} aria-label={t('swipe.yes')}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-3xl text-white shadow-lg shadow-red-500/30 transition hover:scale-110">
                  <FaHeart />
                </button>
              </div>
              <p className="text-center text-xs text-gray-500">{t('swipe.hint')}</p>
            </>
          ) : (
            <section className="rounded-2xl border border-gray-200 p-6 text-center space-y-4 dark:border-zinc-800">
              <p className="text-4xl" aria-hidden>🍿</p>
              <h2 className="text-xl font-semibold">{t('swipe.outOfCards')}</h2>
              <p className="text-sm text-gray-500">{state.match ? '' : t('swipe.outOfCardsText')}</p>
              {state.favorites.length > 0 && (
                <div className="text-start space-y-2">
                  <h3 className="text-sm font-semibold">{t('swipe.closest')}</h3>
                  <ul className="space-y-2">
                    {state.favorites.map(({ card, likes }) => (
                      <li key={card.key}>
                        <Link href={`/${card.media_type}/${card.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-zinc-900">
                          <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                            <TmdbImage kind="poster" path={card.poster_path} fill sizes="44px" alt="" className="object-cover" />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium"><bdi>{card.title}</bdi></span>
                          <span className="inline-flex items-center gap-1 text-sm text-red-500"><FaHeart />{likes}/{state.participants.length}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={newDeck} variant="outline" className="gap-2"><FaRotate />{t('swipe.newDeck')}</Button>
            </section>
          )}
        </>
      )}

      {state.match && dismissedMatch !== state.match.key && (
        <MatchScreen card={state.match} names={names} onNewDeck={newDeck} onClose={() => setDismissedMatch(state.match!.key)} />
      )}
    </div>
  )
}
