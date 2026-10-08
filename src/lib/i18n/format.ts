// Dates, quotes and language/country names in the viewer's language. Dependency-free apart from
// ./locales, so client and server components share it and render the same text (always an explicit
// locale, never the runtime's default).
import { LOCALE_META, dateLocale, htmlLang, type Locale } from './locales'

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** "mercredi 8 octobre" -> "Mercredi 8 octobre" (Latin-script languages only). */
function capitalize(text: string, locale: Locale) {
  return LOCALE_META[locale].script === 'latn' && text ? text.charAt(0).toLocaleUpperCase(htmlLang(locale)) + text.slice(1) : text
}

/**
 * A date in the viewer's language. A calendar day ('2026-10-08', as TMDB gives them) is read at
 * noon UTC and shown in UTC, so it never slips to the day before or after with the time zone.
 * `headline`: the first letter capitalized, for a date that stands alone as a title (French writes
 * day and month names in lowercase). '' when the value isn't a date.
 */
export function formatDate(v: string | number | Date, l: Locale, o: Intl.DateTimeFormatOptions, x?: { headline?: boolean }): string {
  const dayOnly = typeof v === 'string' && DAY_ONLY.test(v)
  const date = dayOnly ? new Date(`${v}T12:00:00Z`) : v instanceof Date ? v : new Date(v)
  if (Number.isNaN(date.getTime())) return ''
  const options = dayOnly ? { timeZone: 'UTC', ...o } : o
  let text: string
  try {
    text = new Intl.DateTimeFormat(dateLocale(l), options).format(date)
  } catch {
    text = date.toISOString().slice(0, 10)
  }
  return x?.headline ? capitalize(text, l) : text
}

/** A quotation: « like this » in French (narrow no-break spaces inside), “like this” otherwise. */
export function quote(text: string, l: Locale): string {
  return l === 'fr' ? `«\u202f${text}\u202f»` : `“${text}”`
}

const displayNames = new Map<string, Intl.DisplayNames | null>()

function nameOf(type: 'language' | 'region', code: string, l: Locale): string | undefined {
  if (!code) return undefined
  const key = `${type}:${l}`
  let names = displayNames.get(key)
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([htmlLang(l), 'en'], { type, fallback: 'none' })
    } catch {
      names = null
    }
    displayNames.set(key, names)
  }
  try {
    const name = names?.of(code)
    // Unknown codes come back as undefined (fallback: 'none') or as the code itself.
    return name && name.toLowerCase() !== code.toLowerCase() ? capitalize(name, l) : undefined
  } catch {
    return undefined
  }
}

/** 'en' -> 'Anglais' in French, 'الإنجليزية' in Arabic. Undefined for an unknown code. */
export const languageName = (iso: string, l: Locale) => nameOf('language', iso, l)

/** 'TN' -> 'Tunisie' in French, 'تونس' in Arabic. Undefined for an unknown code. */
export const regionName = (iso: string, l: Locale) => nameOf('region', iso?.toUpperCase(), l)
