"use client"
// One "More like this, but…" variation's titles, fetched once per page view and kept while the
// viewer flips between chips (and prefetched when a chip is hovered or focused). A 409 means the
// profile changed in another tab: the page refreshes so the server renders for the new profile.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Kind, Variation } from '@/src/lib/variations'

export type VariationResult = { id: number, media_type: Kind, title?: string, name?: string, poster_path: string | null, backdrop_path: string | null, vote_average: number, genre_ids: number[], release_date?: string, first_air_date?: string, overview?: string }

type Request = { type: Kind, id: string, but: Variation, kids: boolean, locale: string }
type Outcome = { status: 'ok', items: VariationResult[] } | { status: 'error' } | { status: 'profile_changed' }

const cache = new Map<string, Promise<Outcome>>()
/** Variations already here, so flipping back to one shows it at once (no loading frame). */
const settled = new Map<string, VariationResult[]>()
const keyOf = (r: Request) => `${r.type}:${r.id}:${r.but}:${r.kids ? 1 : 0}:${r.locale}`

function load(request: Request): Promise<Outcome> {
  const key = keyOf(request)
  const cached = cache.get(key)
  if (cached) return cached
  const query = new URLSearchParams({ type: request.type, id: request.id, but: request.but, kids: request.kids ? '1' : '0', l: request.locale })
  const promise = fetch(`/api/more-like-this?${query}`)
    .then(async (response): Promise<Outcome> => {
      if (response.status === 409) return { status: 'profile_changed' }
      if (!response.ok) return { status: 'error' }
      const body = await response.json()
      return { status: 'ok', items: Array.isArray(body?.items) ? body.items : [] }
    })
    .catch((): Outcome => ({ status: 'error' }))
    .then((outcome) => {
      // Failures are not kept: "Try again" asks again.
      if (outcome.status === 'ok') settled.set(key, outcome.items)
      else cache.delete(key)
      return outcome
    })
  cache.set(key, promise)
  return promise
}

/** Starts loading a variation in the background (hover or focus on its chip). */
export function prefetchVariation(request: Request) {
  void load(request)
}

export type VariationState = { status: 'idle' | 'loading' | 'ready' | 'error', items: VariationResult[], /** Loading for more than 150ms: show skeletons. */ slow: boolean }

/** The titles of `but` (nothing for 'closest' or null: those come with the page). */
export function useVariation(request: Omit<Request, 'but'> & { but: Variation | null }): VariationState & { retry: () => void } {
  const router = useRouter()
  const [state, setState] = useState<VariationState & { key: string | null }>({ status: 'idle', items: [], slow: false, key: null })
  const [attempt, setAttempt] = useState(0)
  const refreshed = useRef(false)
  const { type, id, but, kids, locale } = request
  const key = but ? keyOf({ type, id, but, kids, locale }) : null

  useEffect(() => {
    if (!but || !key || settled.has(key)) return
    let live = true
    setState({ status: 'loading', items: [], slow: false, key })
    const slow = setTimeout(() => { if (live) setState((current) => (current.key === key && current.status === 'loading' ? { ...current, slow: true } : current)) }, 150)
    load({ type, id, but, kids, locale }).then((outcome) => {
      if (!live) return
      if (outcome.status === 'ok') return setState({ status: 'ready', items: outcome.items, slow: false, key })
      if (outcome.status === 'profile_changed' && !refreshed.current) {
        refreshed.current = true
        router.refresh()
        return
      }
      setState({ status: 'error', items: [], slow: false, key })
    })
    return () => {
      live = false
      clearTimeout(slow)
    }
  }, [type, id, but, kids, locale, key, attempt, router])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  // Read synchronously, so a switch never shows the previous variation's titles for a frame.
  const ready = key ? settled.get(key) : undefined
  if (ready) return { status: 'ready', items: ready, slow: false, retry }
  if (state.key !== key) return { status: key ? 'loading' : 'idle', items: [], slow: false, retry }
  return { status: state.status, items: state.items, slow: state.slow, retry }
}
