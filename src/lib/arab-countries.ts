// The 22 member states of the Arab League (ISO 3166-1 alpha-2, lowercase as in our URLs), and what
// the site does with them: their TMDB codes, their page, their name in the viewer's language.
// Pure helpers, safe on the server and the client.

export type ArabCountryCode = 'dz' | 'bh' | 'km' | 'dj' | 'eg' | 'iq' | 'jo' | 'kw' | 'lb' | 'ly' | 'mr' | 'ma' | 'om' | 'ps' | 'qa' | 'sa' | 'so' | 'sd' | 'sy' | 'tn' | 'ae' | 'ye'

export const ARAB_COUNTRY_CODES: readonly ArabCountryCode[] = [
  'dz', 'bh', 'km', 'dj', 'eg', 'iq', 'jo', 'kw', 'lb', 'ly', 'mr',
  'ma', 'om', 'ps', 'qa', 'sa', 'so', 'sd', 'sy', 'tn', 'ae', 'ye',
]

/** The same countries as TMDB writes them (origin_country, with_origin_country): uppercase. */
export const ARAB_TMDB_COUNTRIES: readonly string[] = ARAB_COUNTRY_CODES.map((code) => code.toUpperCase())

const CODES = new Set<string>(ARAB_COUNTRY_CODES)

/** A lowercase Arab League code ('tn', 'eg'...). TMDB's uppercase 'TN' is not one: lowercase it first. */
export function isArabCountry(v: string): v is ArabCountryCode {
  return CODES.has(v)
}

/** The first Arab country among a title's origin countries (TMDB's uppercase codes), if any. */
export function arabCountryOf(o?: readonly string[] | null): ArabCountryCode | null {
  for (const code of o ?? []) {
    const lower = String(code).toLowerCase()
    if (isArabCountry(lower)) return lower
  }
  return null
}

/** A country's page. Tunisia has its own cinema page. */
export function arabCountryHref(c: ArabCountryCode): string {
  return c === 'tn' ? '/tunisian/cinema' : `/arab-cinema/${c}`
}

/** Arabic script UI languages ('ar', 'ar-TN', and the site's Derja 'tn'): Intl knows them as Arabic. */
const isArabicLanguage = (lang: string) => lang === 'tn' || lang.toLowerCase().startsWith('ar')

/**
 * The country's name in the viewer's language (`lang`: a site locale or a BCP 47 tag), from Intl.
 * Palestine is always named Palestine (Intl's data says "Palestinian Territories").
 */
export function arabCountryName(c: ArabCountryCode, lang: string): string {
  const arabic = isArabicLanguage(lang)
  if (c === 'ps') return arabic ? 'فلسطين' : 'Palestine'
  // 'tn' is Tswana to Intl: the site's Derja is Arabic.
  const tag = arabic ? 'ar' : lang || 'en'
  try {
    return new Intl.DisplayNames([tag, 'en'], { type: 'region' }).of(c.toUpperCase()) ?? c.toUpperCase()
  } catch {
    return c.toUpperCase()
  }
}
