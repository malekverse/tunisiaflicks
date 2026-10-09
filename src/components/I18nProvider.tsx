"use client"
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  LOCALE_COOKIE, LOCALE_META, dateLocale, dirOf, htmlLang, type Dir, type Locale,
} from '@/src/lib/i18n/locales'
import { translatorFrom, type TVars, type Translate } from '@/src/lib/i18n/translate'
import type { TKey } from '@/src/lib/i18n'
import { syncLocale } from '@/src/lib/i18n/sync-locale'
import { toast } from '@/src/hooks/use-toast'

type I18nContextValue = {
  /** The language the page is rendered in (the server's, after a switch has landed). */
  locale: Locale
  dir: Dir
  t: Translate
  /** The strings `t` translates with: the shell's, and under an I18nScope the page's too. */
  messages: Record<string, string>
  /** Locale for `toLocaleDateString` & co. (Arabic with Latin digits). */
  dateLocale: string
  /** Switches the whole page at once (see I18nProvider). */
  setLocale: (locale: Locale) => void
  /** The language being switched to, until the page has re-rendered in it. */
  pendingLocale: Locale | null
  switching: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

const ONE_YEAR = 60 * 60 * 24 * 365
/** The page dims while it re-renders in the new language; it never stays dim longer than this. */
const MAX_DIM_MS = 4000
const PENDING_ATTRIBUTE = 'data-locale-pending'
/** Before paint in the browser (no frame with the new strings in the old direction); a no-op on the server. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const warned = new Set<string>()

/**
 * `t` over `messages`. In development it says when a key isn't there: a client component translating
 * a key the server doesn't send to this page (scripts/client-i18n-keys.mjs decides which it sends).
 */
function translator(messages: Record<string, string>): Translate {
  const translate = translatorFrom(messages)
  if (process.env.NODE_ENV === 'production') return translate
  return (key, vars) => {
    if (!(key in messages) && !warned.has(key)) {
      warned.add(key)
      console.warn(`[i18n] '${key}' isn't among this page's strings: run \`npm run i18n:keys\`.`)
    }
    return translate(key, vars)
  }
}

function writeCookie(locale: Locale) {
  const secure = location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax${secure}`
}

/**
 * UI language for client components.
 *
 * The locale comes from the server (the cookie, read by the root layout) and so does `messages`,
 * the active language's strings that client components translate (the shell's; a page adds its own
 * with ClientMessages, see I18nScope). Switching is atomic: there is never a frame where the chrome
 * speaks the new language and the page the old one. setLocale writes the cookie, dims the page
 * (globals.css, `html[data-locale-pending]`) and refreshes the server components in a transition;
 * the new locale and strings arrive together with the new server output, in one commit. Then
 * <html lang dir> follow, the dim lifts and screen readers hear "Language: Français". Offline, the
 * switch waits for the connection (and says so).
 */
export function I18nProvider({ locale, messages, children }: {
  locale: Locale
  /** The shell's strings in `locale` (clientMessages), English filling the gaps. */
  messages?: Record<string, string>
  children: React.ReactNode
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const dimTimer = useRef<ReturnType<typeof setTimeout>>()
  const waitingOnline = useRef<(() => void) | null>(null)
  const committed = useRef(locale)

  const shell = useMemo(() => messages ?? {}, [messages])
  const t = useMemo<Translate>(() => translator(shell), [shell])
  const tRef = useRef(t)
  tRef.current = t

  const lift = useCallback(() => {
    clearTimeout(dimTimer.current)
    document.documentElement.removeAttribute(PENDING_ATTRIBUTE)
  }, [])

  // The new server output (and with it this locale) has landed: finish the switch in the same
  // frame, so the new language never paints in the old direction.
  useIsomorphicLayoutEffect(() => {
    const html = document.documentElement
    html.lang = htmlLang(locale)
    html.dir = dirOf(locale)
    if (committed.current !== locale) {
      committed.current = locale
      lift()
      setPendingLocale((pending) => (pending === locale ? null : pending))
      setAnnouncement(tRef.current('languages.switched', { language: LOCALE_META[locale].endonym }))
    }
  }, [locale, lift])

  useEffect(() => () => {
    clearTimeout(dimTimer.current)
    if (waitingOnline.current) window.removeEventListener('online', waitingOnline.current)
  }, [])

  const switchTo = useCallback((next: Locale) => {
    writeCookie(next)
    setPendingLocale(next === committed.current ? null : next)
    if (next === committed.current) {
      // Back to the language on screen before the other one landed: nothing to wait for.
      lift()
    } else {
      document.documentElement.setAttribute(PENDING_ATTRIBUTE, '')
      clearTimeout(dimTimer.current)
      dimTimer.current = setTimeout(lift, MAX_DIM_MS)
    }
    startTransition(() => router.refresh())
    void syncLocale(next)
  }, [router, lift])

  const setLocale = useCallback((next: Locale) => {
    if (next === (pendingLocale ?? committed.current)) return
    if (waitingOnline.current) {
      window.removeEventListener('online', waitingOnline.current)
      waitingOnline.current = null
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // The new language needs the server: switch as soon as the connection is back.
      setPendingLocale(next === committed.current ? null : next)
      if (next === committed.current) return
      const resume = () => {
        waitingOnline.current = null
        switchTo(next)
      }
      waitingOnline.current = resume
      window.addEventListener('online', resume, { once: true })
      toast({ title: tRef.current('languages.offline') })
      return
    }
    switchTo(next)
  }, [pendingLocale, switchTo])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    dir: dirOf(locale),
    t,
    messages: shell,
    dateLocale: dateLocale(locale),
    setLocale,
    pendingLocale,
    switching: pendingLocale !== null,
  }), [locale, t, shell, setLocale, pendingLocale])

  return (
    <I18nContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
    </I18nContext.Provider>
  )
}

/**
 * A page's own strings joining the shell's, for the client components under it. ClientMessages
 * renders it on the server, so after a language switch they arrive with the page's new server
 * output, in the same commit as the shell's.
 */
export function I18nScope({ messages, children }: { messages: Record<string, string>, children: React.ReactNode }) {
  const parent = useI18n()
  const merged = useMemo(() => ({ ...parent.messages, ...messages }), [parent.messages, messages])
  const t = useMemo<Translate>(() => translator(merged), [merged])
  const value = useMemo<I18nContextValue>(() => ({ ...parent, messages: merged, t }), [parent, merged, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within <I18nProvider>')
  return context
}

export const useT = () => useI18n().t

/** Text direction for Radix roots (`dir` prop): menus, selects and tabs don't read it from <html>. */
export const useDir = () => useContext(I18nContext)?.dir ?? 'ltr'

/** Translated text, usable from components that render on both the server and the client. */
export function T({ k, vars }: { k: TKey, vars?: TVars }) {
  return <>{useT()(k, vars)}</>
}
