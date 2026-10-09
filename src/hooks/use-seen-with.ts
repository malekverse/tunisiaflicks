"use client"
// "Where have I seen them?": the cast matched against the profile's own history, on demand. The
// first press asks the server; later presses show or hide the answer.
import { useCallback, useRef, useState } from 'react'
import { htmlLang, type Locale } from '@/src/lib/i18n/locales'

export type SeenTitle = { media_type: 'movie' | 'tv', id: string, title: string, poster_path: string | null, year: string | null }

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

/** `countKey('seen.fan', 'ar', 2)` → 'seen.fan.two' (Intl.PluralRules of the language). */
export function countKey<B extends string>(base: B, locale: Locale, count: number): `${B}.${PluralCategory}` {
  if (count === 0) return `${base}.zero`
  let category: PluralCategory = 'other'
  try {
    category = new Intl.PluralRules(htmlLang(locale)).select(count) as PluralCategory
  } catch {
    // An unknown language: 'other' reads fine.
  }
  return `${base}.${category}`
}

export type SeenWithState = { status: 'idle' | 'loading' | 'ready' | 'error', people: Record<string, SeenTitle[]>, shown: boolean }

export function useSeenWith({ people, exclude }: { people: number[], exclude: string }) {
  const [state, setState] = useState<SeenWithState>({ status: 'idle', people: {}, shown: false })
  const busy = useRef(false)

  const toggle = useCallback(async () => {
    if (state.status === 'ready') {
      setState((current) => ({ ...current, shown: !current.shown }))
      return
    }
    if (busy.current || !people.length) return
    busy.current = true
    setState((current) => ({ ...current, status: 'loading' }))
    try {
      const query = new URLSearchParams({ people: people.slice(0, 30).join(','), exclude })
      const response = await fetch(`/api/seen-with?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const body = await response.json()
      setState({ status: 'ready', people: body?.people && typeof body.people === 'object' ? body.people : {}, shown: true })
    } catch {
      setState((current) => ({ ...current, status: 'error' }))
    } finally {
      busy.current = false
    }
  }, [state.status, people, exclude])

  return { ...state, toggle }
}
