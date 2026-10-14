// A one-time toast that offers a visitor who never picked a language the ones spoken where they
// are. Mounted in the root layout beside the Toaster.
//
// The site always opens in English until the visitor chooses (lib/i18n/locales resolveLocale). On
// the first visit, a moment after the page settles, this suggests the languages of the visitor's
// country and browser (suggestLocales, worked out by the layout): Arabic and French in Tunisia,
// French in France... each a tap away, or the visitor keeps English or simply closes it. Either way
// it never shows again on this device; a chosen language stays for good (the tf-locale cookie).
// Never on the profile picker (a full-screen choice of its own).
"use client"
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/src/components/I18nProvider'
import { LOCALE_COOKIE, LOCALE_META, htmlLang, type Locale } from '@/src/lib/i18n/locales'

const SEEN_KEY = 'tf-lang-hint'
const DELAY_MS = 1200
const DURATION_MS = 12000

const hasLocaleCookie = () => document.cookie.split(';').some((part) => part.trim().startsWith(`${LOCALE_COOKIE}=`))

export default function LanguageHint({ suggested }: { suggested: Locale[] }): null {
  const { locale, setLocale, t } = useI18n()
  const pathname = usePathname()
  const onProfiles = pathname === '/profiles' || pathname.startsWith('/profiles/')
  const offered = suggested.filter((value) => value !== locale)

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
      const id = toast(t('languages.hint.title'), {
        duration: DURATION_MS,
        description: (
          <>
            <span className="block">{t('languages.hint.text')}</span>
            {/* Real 44px buttons under the text (Sonner's own action buttons are small and sit
                beside it): the suggested languages, each named in its own language, the first one
                as the main action; then keeping English. */}
            <span role="group" aria-label={t('languages.hint.others')} className="mt-3 flex flex-wrap gap-2">
              {offered.map((value, index) => (
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
              <button
                type="button"
                onClick={() => toast.dismiss(id)}
                className="pressable h-11 rounded-full px-3 text-[14px] font-medium text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
              >
                {t('languages.hint.keep', { language: LOCALE_META[locale].label })}
              </button>
            </span>
          </>
        ),
      })
    }, DELAY_MS)
    return () => clearTimeout(timer)
    // Once per page view; the translator changing must not show it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onProfiles])

  return null
}
