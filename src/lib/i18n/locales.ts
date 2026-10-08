// The UI languages and what follows from each one (direction, <html lang>, date formatting).
// No imports, no dictionaries: client components and middleware can use these without pulling the
// strings into their bundle.

/** English, Modern Standard Arabic, and Tunisian Arabic (Derja). */
export type Locale = 'en' | 'ar' | 'tn'
export type Dir = 'ltr' | 'rtl'

export const LOCALES: readonly Locale[] = ['en', 'ar', 'tn']
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'tf-locale'

export const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'ar' || value === 'tn'
/** Arabic and Derja: right-to-left, Arabic font, Arabic TMDB data. */
export const isArabicScript = (locale: Locale) => locale !== 'en'
export const dirOf = (locale: Locale): Dir => (isArabicScript(locale) ? 'rtl' : 'ltr')
/** BCP 47 tag for <html lang>. */
export const htmlLang = (locale: Locale) => (locale === 'tn' ? 'ar-TN' : locale)

/**
 * Locale for `Intl` / `toLocaleDateString`. Arabic uses Tunisian month names with Latin digits
 * (`-u-nu-latn`); English keeps the browser default, as before.
 */
export const dateLocale = (locale: Locale): string | undefined => (isArabicScript(locale) ? 'ar-TN-u-nu-latn' : undefined)
