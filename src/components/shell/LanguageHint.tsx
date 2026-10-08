// A one-time toast that offers the other languages to a visitor who never picked one. Mounted in
// the root layout beside the Toaster.
//
// The site guessed French from the browser (no tf-locale cookie yet): say so once per device, a
// moment after the page settles, with Arabic and English one tap away. Never on the profile picker
// (it is a full-screen choice of its own).
"use client"
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/src/components/I18nProvider'
import { LOCALE_COOKIE, LOCALE_META, htmlLang, type Locale } from '@/src/lib/i18n/locales'

const SEEN_KEY = 'tf-lang-hint'
const DELAY_MS = 1200
const DURATION_MS = 9000
/** The languages the hint offers, in this order: the main action first. */
const OFFERED: Locale[] = ['ar', 'en']

const hasLocaleCookie = () => document.cookie.split(';').some((part) => part.trim().startsWith(`${LOCALE_COOKIE}=`))

export default function LanguageHint(): null {
  const { locale, setLocale, t } = useI18n()
  const pathname = usePathname()
  const onProfiles = pathname === '/profiles' || pathname.startsWith('/profiles/')

  useEffect(() => {
    if (locale !== 'fr' || onProfiles || hasLocaleCookie()) return
    try {
      if (localStorage.getItem(SEEN_KEY)) return
    } catch {
      return // No storage, no way to show it only once: don't show it.
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SEEN_KEY, '1')
      } catch {
        return
      }
      const id = toast(t('languages.hint.title'), {
        duration: DURATION_MS,
        description: (
          <>
            <span className="block">{t('languages.hint.text')}</span>
            {/* Real 44px buttons under the text (Sonner's own action buttons are small and sit
                beside it): Arabic first, then English, each named in its own language. */}
            <span role="group" aria-label={t('languages.hint.others')} className="mt-3 flex gap-2">
              {OFFERED.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  lang={htmlLang(value)}
                  dir={LOCALE_META[value].dir}
                  aria-label={LOCALE_META[value].endonym}
                  onClick={() => {
                    toast.dismiss(id)
                    setLocale(value)
                  }}
                  className={
                    index === 0
                      ? 'pressable h-11 min-w-[88px] rounded-full bg-white px-5 text-[14px] font-semibold text-black outline-none focus-visible:ring-2 focus-visible:ring-red-500'
                      : 'pressable h-11 min-w-[88px] rounded-full bg-white/[0.1] px-5 text-[14px] font-medium text-white outline-none transition-colors hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-red-500'
                  }
                >
                  {LOCALE_META[value].label}
                </button>
              ))}
            </span>
          </>
        ),
      })
    }, DELAY_MS)
    return () => clearTimeout(timer)
    // Once per page view; the translator changing must not show it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, onProfiles])

  return null
}
