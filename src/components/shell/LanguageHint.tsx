// A one-time card that offers a visitor who never picked a language the ones spoken where they
// are. Mounted in the root layout.
//
// The site always opens in English until the visitor chooses (lib/i18n/locales resolveLocale). On
// the first visit, a moment after the page settles, a small card in the bottom corner (the end
// side: bottom right in English, bottom left in Arabic) suggests the languages of the visitor's
// country and browser (suggestLocales, worked out by the layout): Arabic, French and Derja in
// Tunisia, French in France... each a tap away; the ✕, Escape or simply waiting keeps English.
// Either way it never shows again on this device; a chosen language stays for good (the tf-locale
// cookie). Never on the profile picker (a full-screen choice of its own). While it's open, the app
// offer (components/apps/AppOffer) waits: HINT_OPEN_ATTRIBUTE on <html>.
"use client"
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Languages, X } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { LOCALE_COOKIE, LOCALE_META, htmlLang, type Locale } from '@/src/lib/i18n/locales'

const SEEN_KEY = 'tf-lang-hint'
const DELAY_MS = 1500
/** It leaves by itself after this long (English stays). */
const SHOWN_MS = 15000
/** On <html> while the card is open: other corner cards wait. */
export const HINT_OPEN_ATTRIBUTE = 'data-lang-hint'

const hasLocaleCookie = () => document.cookie.split(';').some((part) => part.trim().startsWith(`${LOCALE_COOKIE}=`))

export default function LanguageHint({ suggested }: { suggested: Locale[] }) {
  const { locale, setLocale, t } = useI18n()
  const pathname = usePathname()
  const onProfiles = pathname === '/profiles' || pathname.startsWith('/profiles/')
  const offered = suggested.filter((value) => value !== locale)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!offered.length || onProfiles || hasLocaleCookie()) return
    try {
      if (localStorage.getItem(SEEN_KEY)) return
    } catch {
      return // No storage, no way to show it only once: don't show it.
    }
    const timer = setTimeout(() => {
      // Seen once it shows: closed, ignored or answered, it never comes back.
      try {
        localStorage.setItem(SEEN_KEY, '1')
      } catch {
        return
      }
      setOpen(true)
    }, DELAY_MS)
    return () => clearTimeout(timer)
    // Once per page view; the translator changing must not show it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onProfiles])

  // Open: it leaves by itself after a while, Escape closes it, and other corner cards wait.
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    html.setAttribute(HINT_OPEN_ATTRIBUTE, '')
    const timer = setTimeout(() => setOpen(false), SHOWN_MS)
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      html.removeAttribute(HINT_OPEN_ATTRIBUTE)
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null
  return (
    <div
      role="region"
      aria-labelledby="lang-hint-title"
      className="fixed bottom-[calc(var(--tabbar-space)+8px)] end-3 z-30 border border-white/[0.08] bg-[rgb(20_20_22/0.94)] backdrop-blur-xl w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl p-3.5 pe-9 shadow-[0_14px_40px_-12px_rgb(0_0_0/0.9)] animate-in fade-in slide-in-from-bottom-3 duration-300 motion-reduce:slide-in-from-bottom-0 lg:bottom-6 lg:end-6"
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={t('common.close')}
        className="pressable absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full text-white/55 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
      <p id="lang-hint-title" className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white">
        <Languages aria-hidden className="h-4 w-4 shrink-0 text-white/60" />
        {t('languages.hint.title')}
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-white/55">{t('languages.hint.text')}</p>
      {/* The suggested languages, each named in its own language; the first as the main action. */}
      <div role="group" aria-label={t('languages.hint.others')} className="mt-2.5 flex flex-wrap gap-1.5">
        {offered.map((value, index) => (
          <button
            key={value}
            type="button"
            lang={htmlLang(value)}
            dir={LOCALE_META[value].dir}
            aria-label={LOCALE_META[value].endonym}
            onClick={() => {
              setOpen(false)
              setLocale(value)
            }}
            className={
              index === 0
                ? 'pressable h-8 rounded-full bg-white px-3.5 text-[13px] font-semibold text-black outline-none focus-visible:ring-2 focus-visible:ring-red-500'
                : 'pressable h-8 rounded-full bg-white/[0.1] px-3.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-red-500'
            }
          >
            {LOCALE_META[value].label}
          </button>
        ))}
      </div>
    </div>
  )
}
