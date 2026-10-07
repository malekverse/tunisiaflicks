// Server-side access to the UI language (server components, generateMetadata, route handlers).
import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, createTranslator, isLocale, type Locale } from '.'

/**
 * The browser's preferred language from `Accept-Language` ("ar-TN,ar;q=0.9,fr;q=0.8" -> "ar"):
 * the entry with the highest q (ties keep header order), without its region.
 */
export function preferredLanguage(acceptLanguage: string | null): string | undefined {
  let best: { language: string, q: number } | undefined
  for (const part of (acceptLanguage ?? '').split(',')) {
    const [tag, ...params] = part.trim().split(';')
    if (!tag || tag === '*') continue
    const qParam = params.find((param) => param.trim().startsWith('q='))
    const q = qParam ? Number(qParam.trim().slice(2)) : 1
    if (Number.isNaN(q) || q <= 0) continue
    if (!best || q > best.q) best = { language: tag.toLowerCase().split('-')[0], q }
  }
  return best?.language
}

/**
 * The chosen UI language (cookie set by the language switch); before any choice, Arabic when the
 * browser's preferred language is Arabic, English otherwise.
 */
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value
  if (isLocale(value)) return value
  return preferredLanguage(headers().get('accept-language')) === 'ar' ? 'ar' : DEFAULT_LOCALE
}

export function getT() {
  return createTranslator(getLocale())
}
