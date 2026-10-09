// The UI languages and what follows from each one (direction, <html lang>, date formatting, the
// TMDB language, Open Graph). No imports, no dictionaries: client components and middleware can
// use these without pulling the strings into their bundle.
//
// One table, LOCALE_META, holds every per-language fact; the helpers below read it, so adding a
// language is one row here plus its dictionary.

/** English, French, Modern Standard Arabic, and Tunisian Arabic (Derja). */
export type Locale = 'en' | 'fr' | 'ar' | 'tn'
export type Dir = 'ltr' | 'rtl'

export type LocaleMeta = {
  /** On the compact switch and on phones: 'EN', 'FR', 'عربي', 'تونسي'. */
  short: string
  /** On the full-width switch from 420px up. */
  label: string
  /** The language's own name, for screen readers ('Français', 'العربية'). */
  endonym: string
  dir: Dir
  script: 'latn' | 'arab'
  /** BCP 47 tag for <html lang>. */
  htmlLang: string
  /** Open Graph locale (og:locale). */
  og: string
  /** TMDB `language` parameter. */
  tmdb: string
  /** Locale for `Intl` dates (Arabic with Tunisian month names and Latin digits). */
  date: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { short: 'EN', label: 'English', endonym: 'English', dir: 'ltr', script: 'latn', htmlLang: 'en', og: 'en_US', tmdb: 'en-US', date: 'en-GB' },
  fr: { short: 'FR', label: 'Français', endonym: 'Français', dir: 'ltr', script: 'latn', htmlLang: 'fr', og: 'fr_FR', tmdb: 'fr-FR', date: 'fr-FR' },
  ar: { short: 'عربي', label: 'عربي', endonym: 'العربية', dir: 'rtl', script: 'arab', htmlLang: 'ar', og: 'ar_TN', tmdb: 'ar', date: 'ar-TN-u-nu-latn' },
  tn: { short: 'تونسي', label: 'تونسي', endonym: 'تونسي (الدارجة)', dir: 'rtl', script: 'arab', htmlLang: 'ar-TN', og: 'ar_TN', tmdb: 'ar', date: 'ar-TN-u-nu-latn' },
}

/** The switch's order: English, French, Arabic, Derja. */
export const LOCALES: readonly Locale[] = ['en', 'fr', 'ar', 'tn']
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'tf-locale'

export const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
/** Arabic and Derja: right-to-left, Arabic font, Arabic TMDB data. */
export const isArabicScript = (locale: Locale) => LOCALE_META[locale].script === 'arab'
export const dirOf = (locale: Locale): Dir => LOCALE_META[locale].dir
/** BCP 47 tag for <html lang>. */
export const htmlLang = (locale: Locale) => LOCALE_META[locale].htmlLang

/**
 * Locale for `Intl` / `toLocaleDateString`, always explicit (never the runtime default, so the
 * server and the browser agree): British English, French, and Arabic with Tunisian month names and
 * Latin digits (`-u-nu-latn`).
 */
export const dateLocale = (locale: Locale): string => LOCALE_META[locale].date

/** og:locale of a page shown in `locale`. */
export const ogLocale = (locale: Locale) => LOCALE_META[locale].og
/** og:locale:alternate: the other languages the site speaks (Derja and Arabic share ar_TN). */
export const ogAlternates = (locale: Locale): string[] =>
  Array.from(new Set(LOCALES.map(ogLocale))).filter((og) => og !== ogLocale(locale))

/** Languages a browser can ask for by itself. Derja has no tag of its own, so it is only ever chosen. */
const NEGOTIABLE: readonly Locale[] = ['en', 'fr', 'ar']

/**
 * The first language of `Accept-Language` that the site speaks, in the browser's order of
 * preference (q values, ties keep header order): "de-DE,fr;q=0.5" -> 'fr', "ar-TN,fr;q=0.8" ->
 * 'ar'. Never 'tn'. Undefined when none of English, French or Arabic is acceptable.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale | undefined {
  const entries: { language: string, q: number, index: number }[] = []
  for (const [index, part] of (acceptLanguage ?? '').split(',').slice(0, 40).entries()) {
    const [tag, ...params] = part.trim().split(';')
    const language = tag?.trim().toLowerCase().split('-')[0]
    if (!language || language === '*') continue
    const qParam = params.map((param) => param.trim()).find((param) => param.startsWith('q='))
    const q = qParam ? Number(qParam.slice(2)) : 1
    if (!Number.isFinite(q) || q <= 0) continue
    entries.push({ language, q, index })
  }
  entries.sort((a, b) => b.q - a.q || a.index - b.index)
  return entries.map((entry) => entry.language).find((language): language is Locale => (NEGOTIABLE as readonly string[]).includes(language)) as Locale | undefined
}

/**
 * The UI language of a request: the tf-locale cookie (the visitor's choice) wins; before any
 * choice, the browser's languages (negotiateLocale); English otherwise.
 */
export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue
  return negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE
}
