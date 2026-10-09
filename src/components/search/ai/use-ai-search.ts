"use client"
// Asking, in the browser: POST /api/ai/search and read its NDJSON answer as it streams (the chips
// first, then the titles). A newer question aborts the one in flight. The address bar keeps
// /search?mode=ask&q=…&p=… (replaceState), so a shared or reloaded link runs the same plan without
// asking the model again.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AskChip, AskEvent, AskItem, AskNotice } from '@/src/lib/ai-search/types'

export type AskError = { code: string, retryAfter?: number, signIn?: boolean }

export type AskState = {
  phase: 'idle' | 'loading' | 'ready' | 'error'
  /** The question is taking a moment: shown only after 150ms, so fast answers never flash. */
  reading: boolean
  q: string
  /** The plan string (p=) of what's shown. */
  p: string | null
  chips: AskChip[]
  /** The plan came from the AI (its results carry the AI mark and note). */
  ai: boolean
  notices: AskNotice[]
  items: AskItem[]
  page: number
  hasMore: boolean
  /** The next page is loading. */
  more: boolean
  tryWithout: string | null
  error: AskError | null
}

const INITIAL: AskState = {
  phase: 'idle', reading: false, q: '', p: null, chips: [], ai: false, notices: [], items: [], page: 1, hasMore: false, more: false, tryWithout: null, error: null,
}

const READING_DELAY = 150

type Mode = 'new' | 'edit' | 'more'

export function askUrl(q: string, p?: string | null) {
  const params = new URLSearchParams({ mode: 'ask' })
  if (q) params.set('q', q)
  if (p) params.set('p', p)
  return `/search?${params.toString()}`
}

export function useAiSearch(o: {
  /** The answer is a title search after all (a bare title, or nothing Ask could use). */
  onSwitch: (q: string, reason: 'title' | 'resting') => void
  /** "Show more" failed (the shown titles stay). */
  onMoreFailed?: () => void
}) {
  const [state, setState] = useState<AskState>(INITIAL)
  const current = useRef<AbortController | null>(null)
  const readingTimer = useRef<ReturnType<typeof setTimeout>>()
  const handlers = useRef(o)
  handlers.current = o
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => () => {
    current.current?.abort()
    clearTimeout(readingTimer.current)
  }, [])

  const run = useCallback(async (body: { q?: string, plan?: string, page?: number }, mode: Mode, q: string) => {
    current.current?.abort()
    const controller = new AbortController()
    current.current = controller
    clearTimeout(readingTimer.current)
    if (mode === 'more') {
      setState((s) => ({ ...s, more: true }))
    } else {
      setState((s) => ({
        ...s,
        phase: 'loading',
        reading: false,
        q,
        error: null,
        tryWithout: null,
        more: false,
        ...(mode === 'new' ? { p: null, chips: [], notices: [], items: [], ai: false, page: 1, hasMore: false } : {}),
      }))
      readingTimer.current = setTimeout(() => setState((s) => (s.phase === 'loading' ? { ...s, reading: true } : s)), READING_DELAY)
    }

    const fail = (error: AskError) => {
      clearTimeout(readingTimer.current)
      if (mode === 'more') {
        setState((s) => ({ ...s, more: false }))
        handlers.current.onMoreFailed?.()
      } else {
        setState((s) => ({ ...s, phase: 'error', reading: false, error }))
      }
    }

    const handle = (event: AskEvent) => {
      if (controller.signal.aborted) return
      switch (event.t) {
        case 'plan':
          setState((s) => ({
            ...s,
            p: event.p,
            chips: event.chips,
            // A replay keeps what the first answer was; a fresh one says.
            ai: mode === 'new' ? event.ai : s.ai,
            notices: mode === 'new' ? event.notices : s.notices,
          }))
          try {
            window.history.replaceState(window.history.state, '', askUrl(q, event.p))
          } catch {
            // Some embedded browsers refuse; the page still works.
          }
          break
        case 'results':
          clearTimeout(readingTimer.current)
          setState((s) => {
            const items = mode === 'more'
              ? [...s.items, ...event.items.filter((item) => !s.items.some((seen) => seen.id === item.id && seen.media_type === item.media_type))]
              : event.items
            return { ...s, phase: 'ready', reading: false, more: false, items, page: event.page, hasMore: event.hasMore, tryWithout: event.tryWithout }
          })
          break
        case 'switch':
          clearTimeout(readingTimer.current)
          setState(INITIAL)
          handlers.current.onSwitch(event.q, event.reason)
          break
        case 'error':
          fail({ code: event.code })
          break
      }
    }

    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}))
        // Ask was turned off meanwhile: the title search takes over.
        if (response.status === 404 && mode === 'new') {
          handle({ t: 'switch', q, reason: 'resting' })
          return
        }
        fail({ code: typeof data?.code === 'string' ? data.code : 'failed', retryAfter: data?.retryAfter, signIn: !!data?.signIn })
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finished = false
      for (;;) {
        const { done, value } = await reader.read()
        if (value) buffer += decoder.decode(value, { stream: !done })
        let newline = buffer.indexOf('\n')
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (line) {
            const event = JSON.parse(line) as AskEvent
            if (event.t !== 'plan') finished = true
            handle(event)
          }
          newline = buffer.indexOf('\n')
        }
        if (done) break
      }
      if (buffer.trim()) {
        const event = JSON.parse(buffer.trim()) as AskEvent
        if (event.t !== 'plan') finished = true
        handle(event)
      }
      // The stream ended without an answer (the server gave up).
      if (!finished && !controller.signal.aborted) fail({ code: 'failed' })
    } catch {
      if (!controller.signal.aborted) fail({ code: 'failed' })
    }
  }, [])

  /** A new question. */
  const ask = useCallback((q: string) => run({ q }, 'new', q), [run])
  /** A plan from a link (p=): no model call. */
  const open = useCallback((q: string, p: string) => run({ q, plan: p }, 'new', q), [run])
  /** The same question with a part removed: the chip goes at once, the titles follow. */
  const edit = useCallback((p: string, removedChip?: string) => {
    setState((s) => ({ ...s, chips: removedChip ? s.chips.filter((chip) => chip.id !== removedChip) : s.chips }))
    return run({ plan: p }, 'edit', stateRef.current.q)
  }, [run])
  const more = useCallback(() => {
    const s = stateRef.current
    if (!s.p || s.more || !s.hasMore) return
    return run({ plan: s.p, page: s.page + 1 }, 'more', s.q)
  }, [run])
  /** Back to an earlier answer (Undo), without asking again. */
  const restore = useCallback((snapshot: AskState) => {
    current.current?.abort()
    clearTimeout(readingTimer.current)
    setState({ ...snapshot, reading: false, more: false })
    try {
      window.history.replaceState(window.history.state, '', askUrl(snapshot.q, snapshot.p))
    } catch {
      // Ignore.
    }
  }, [])
  /** Back to the empty Ask page. */
  const reset = useCallback(() => {
    current.current?.abort()
    clearTimeout(readingTimer.current)
    setState(INITIAL)
  }, [])

  return { state, ask, open, edit, more, restore, reset }
}
