// Sections other features add to the weekly digest (friends' picks, movie nights, shared lists,
// Tunisian TV, badges...). A provider builds one section for one profile and one week, or null
// when it has nothing worth saying. Each one gets 3 seconds; a slow or failing provider is left
// out of that e-mail, never holds it back. Streaks are never part of an e-mail (they'd read as
// pressure in an inbox): a section whose id mentions a streak is dropped.
// The providers themselves are registered in ./registry.ts (this file stays free of them, so it
// can be tested on its own).
import type { Locale } from '@/src/lib/i18n/locales'
import type { Translate } from '@/src/lib/i18n/translate'

export type DigestTile = {
  title: string
  /** A same-site path ('/movie/550') or an absolute https URL. */
  href: string
  /** A TMDB image path ('/abc.jpg') or an absolute https URL. */
  poster: string | null
  /** One short line under the title ('New episode', 'From Sami'). */
  line?: string
}

export type DigestSection =
  | { type: 'rows'; id: string; title: string; rows: DigestTile[] }
  | { type: 'posters'; id: string; title: string; tiles: DigestTile[] }
  | { type: 'note'; id: string; text: string; href?: string }

export type DigestContext = {
  userId: string
  profileId: string
  /** The language the e-mail is written in (the profile's digest language). */
  locale: Locale
  /** The week the e-mail covers. */
  since: Date
  until: Date
  /** Strings in `locale`. */
  t: Translate
}

export type DigestProvider = { id: string; build: (ctx: DigestContext) => Promise<DigestSection | null> }

export const PROVIDER_TIMEOUT_MS = 3000

/** One provider's section, or null when it fails or takes longer than `ms`. */
async function buildWithin(provider: DigestProvider, ctx: DigestContext, ms: number): Promise<DigestSection | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      provider.build(ctx),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms) }),
    ])
  } catch (error) {
    console.error(`Digest provider ${provider.id} failed:`, error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Every provider's section for one profile, in registration order; the empty and failed ones left out. */
export async function providerSections(ctx: DigestContext, providers: DigestProvider[], ms = PROVIDER_TIMEOUT_MS): Promise<DigestSection[]> {
  const sections = await Promise.all(providers.map((provider) => buildWithin(provider, ctx, ms)))
  return sections.filter((section, index): section is DigestSection => {
    if (!section || typeof section !== 'object') return false
    if (/streak/i.test(section.id) || /streak/i.test(providers[index].id)) return false
    if (section.type === 'rows') return Array.isArray(section.rows) && section.rows.length > 0
    if (section.type === 'posters') return Array.isArray(section.tiles) && section.tiles.length > 0
    return section.type === 'note' && !!section.text
  })
}
