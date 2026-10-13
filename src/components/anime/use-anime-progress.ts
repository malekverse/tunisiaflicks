"use client"
// Where the viewer is in each anime, on this device: the episode they're on, sub or dub, and the
// episodes they've watched (ticked in the episode grid). It feeds "Continue watching" on /anime and
// "Continue EP 5" on a title's page. Kept small: the 40 most recent titles.
import { useCallback, useEffect, useState } from 'react'
import type { AnimeCard } from '@/src/lib/anime/model'

const KEY = 'tf-anime-progress'
const MAX_TITLES = 40
const MAX_WATCHED = 3000

export type AnimeProgress = {
  id: number
  title: string
  cover: string | null
  color: string | null
  format: AnimeCard['format']
  year: number | null
  /** The episode they're on (opened last). */
  episode: number
  /** Episodes out when they last came (to show "3 new"). */
  aired: number
  dub: boolean
  watched: number[]
  at: number
}

type Store = Record<string, AnimeProgress>

const read = (): Store => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const write = (store: Store) => {
  const kept = Object.values(store).sort((a, b) => b.at - a.at).slice(0, MAX_TITLES)
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept.map((entry) => [entry.id, entry]))))
    window.dispatchEvent(new Event(KEY))
  } catch { /* private mode or full: progress just isn't remembered */ }
}

/** Every anime in progress, most recent first ([] until mounted). */
export function useAnimeProgressList(): AnimeProgress[] {
  const [list, setList] = useState<AnimeProgress[]>([])
  useEffect(() => {
    const load = () => setList(Object.values(read()).sort((a, b) => b.at - a.at))
    load()
    window.addEventListener(KEY, load)
    window.addEventListener('storage', load)
    return () => { window.removeEventListener(KEY, load); window.removeEventListener('storage', load) }
  }, [])
  return list
}

/** One anime's progress (null until mounted, or never started), and the ways to move it on. */
export function useAnimeProgress(card: AnimeCard, aired: number) {
  const [progress, setProgress] = useState<AnimeProgress | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setProgress(read()[card.id] ?? null)
    setReady(true)
  }, [card.id])

  const save = useCallback((change: (current: AnimeProgress) => AnimeProgress) => {
    const store = read()
    const current: AnimeProgress = store[card.id] ?? {
      id: card.id, title: card.title, cover: card.cover, color: card.color, format: card.format, year: card.year,
      episode: 1, aired, dub: false, watched: [], at: Date.now(),
    }
    const next = { ...change(current), title: card.title, cover: card.cover, color: card.color, format: card.format, year: card.year, aired, at: Date.now() }
    store[card.id] = next
    write(store)
    setProgress(next)
  }, [card.id, card.title, card.cover, card.color, card.format, card.year, aired])

  /** Opened an episode (and with which audio). */
  const open = useCallback((episode: number, dub: boolean) => save((current) => ({ ...current, episode, dub })), [save])
  /** Watched long enough to count. */
  const markWatched = useCallback((episode: number) => save((current) => ({
    ...current,
    watched: current.watched.includes(episode) ? current.watched : [...current.watched, episode].slice(-MAX_WATCHED),
  })), [save])

  return { progress, ready, open, markWatched }
}
