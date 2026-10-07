"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LOCALE_COOKIE, createTranslator, dateLocale, dirOf,
  type Dir, type Locale, type TKey, type TVars, type Translate,
} from '@/src/lib/i18n'

type I18nContextValue = {
  locale: Locale
  dir: Dir
  t: Translate
  /** Locale for `toLocaleDateString` & co. (Arabic with Latin digits). */
  dateLocale: string | undefined
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * UI language for client components. The initial locale comes from the cookie (read by the root
 * layout); switching rewrites the cookie, flips <html lang dir> right away, and refreshes the server
 * components so they re-render in the new language too.
 */
export function I18nProvider({ locale: initialLocale, children }: { locale: Locale, children: React.ReactNode }) {
  const router = useRouter()
  const [locale, setLocaleState] = useState(initialLocale)

  // The server is the source of truth after a refresh.
  useEffect(() => setLocaleState(initialLocale), [initialLocale])

  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`
    document.documentElement.lang = next
    document.documentElement.dir = dirOf(next)
    setLocaleState(next)
    router.refresh()
  }, [router])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    dir: dirOf(locale),
    t: createTranslator(locale),
    dateLocale: dateLocale(locale),
    setLocale,
  }), [locale, setLocale])

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
