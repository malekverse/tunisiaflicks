// Where a Tunisian FILM can actually be watched in full. The source blog (lib/tunisian) carries only
// a trailer for films, and the generic movie sources (third-party providers, torrents) don't carry
// Tunisian indie cinema, so a film is given a layered source, best first:
//   1. A full-length upload on a TRUSTED Tunisian channel (official state TV and a short allowlist of
//      cinema channels, all already ingested by lib/tunisian-tv). NEVER a blind title search: that
//      serves the wrong film and 18+ clickbait (dangerous with Halal mode). A match is accepted only
//      when the upload is on an allowlisted channel AND runs at least ~40 minutes AND its title
//      matches the film's — the duration and the allowlist do the safety work, the title the precision.
//   2. An honest outbound link to a legal Tunisian platform (Artify, Raksha) when a verified entry
//      says the film is there. Linking out, never embedding, and only when verified (curated): a blind
//      "find it on Artify" link would claim every trailer-only film is there.
//   3. Nothing more: the blog's trailer, and "not online yet".
//
// Pure, no I/O: the matching and the normalisation are unit tested (tests/tunisian-film.unit.test.ts).
// The database side (reading the trusted channels' long uploads) is in lib/tunisian-tv/read.
import { fold } from '@/src/lib/tunisian-match'

const ARABIC = /[؀-ۿ]/
const LATIN = /[a-z]/

/** A full film runs at least this long: shorter uploads are clips, teasers or episodes, never a film. */
export const MIN_FILM_SECONDS = 40 * 60

// Words that aren't part of a film's identity, dropped from both the catalogue's title and the upload's
// ("فيلم تونسي كامل جودة عالية", "Film Complet HD", "Full Movie"), plus the articles both sides drop.
const STOP_WORDS = new Set([
  'film', 'films', 'movie', 'cinema', 'complet', 'complete', 'kamel', 'full', 'hd', 'fhd', '4k', 'vf', 'vostfr', 'vo',
  'le', 'la', 'les', 'el', 'al', 'un', 'une', 'the', 'officiel', 'official',
  // The Arabic words are written in their FOLDED form (see fold(): ة→ه, أ→ا …), as the tokens are.
  'فيلم', 'الفيلم', 'مشاهده', 'كامل', 'كامله', 'كاملا', 'تونسي', 'تونسيه', 'اونلاين', 'جوده', 'عاليه', 'بجوده', 'سينما',
])

/** An upload that is a clip, teaser or trailer rather than the film itself (belt and braces with the duration). */
const CLIP_WORDS = /ملخص|برومو|كواليس|إعلان|اعلان|مقتطف|دعاية|\bpromo\b|\bteaser\b|\btrailer\b|\bbande[- ]?annonce\b|\bextrait\b|\bmaking[- ]?of\b|\bbest[- ]?of\b|\bclip\b/iu

const rawTokens = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** A 4-digit film year (1950–2099) written in a title, or null. */
export function yearIn(text: string): number | null {
  const match = (text ?? '').match(/\b(19[5-9]\d|20\d{2})\b/)
  return match ? Number(match[1]) : null
}

/** A title reduced to the words that identify it: no "film", "complet", "HD", articles, years or stray numbers. */
export function filmTokens(title: string): string[] {
  return rawTokens(title).filter((token) => !STOP_WORDS.has(token) && !/^\d+$/.test(token) && token.length >= 2)
}

/** The identifying words of a title, split by script ("فيلم بسطانجي Bastardo" → { ar: ['بسطانجي'], latin: ['bastardo'] }). */
export function filmTitleKeys(title: string): { ar: string[], latin: string[] } {
  const tokens = filmTokens(title)
  return {
    ar: tokens.filter((token) => ARABIC.test(token)),
    latin: tokens.filter((token) => LATIN.test(token) && !ARABIC.test(token)),
  }
}

/** An upload on an allowlisted channel, as the matching sees it. */
export type FilmUploadCandidate = {
  /** The YouTube video id. */
  id: string
  /** The channel's slug (every candidate is from an allowlisted, trusted channel). */
  channel: string
  title: string
  /** Seconds; null when unknown. A film must have a known, long duration, so null never matches. */
  duration: number | null
  views?: number | null
  publishedAt?: string | null
}

export type FilmMatchQuery = {
  /** The film's title in every spelling worth trying (the blog's, TMDB's title and original title). */
  titles: string[]
  year?: number | null
}

/**
 * Whether a candidate's title matches one of the query's titles confidently in one script: every
 * identifying word of that title is present in the candidate's. A one-word title has to be a
 * distinctive word (4+ letters) to match on its own, so "باب" (door) doesn't match every film.
 */
function titleMatches(queryKeys: { ar: string[], latin: string[] }, candidate: Set<string>): boolean {
  const covers = (words: string[]) => {
    if (words.length === 0) return false
    if (words.length === 1 && words[0].length < 4) return false
    return words.every((word) => candidate.has(word))
  }
  return covers(queryKeys.ar) || covers(queryKeys.latin)
}

/**
 * The full-length upload a film is, from uploads on trusted channels only (the caller passes only
 * allowlisted channels' uploads). A candidate must run at least MIN_FILM_SECONDS, not be a clip, and
 * have a title that matches the film's. A year in both that is more than a year apart rules a
 * candidate out (another film of the same name). Among the matches: the tightest title (fewest extra
 * words), then a matching year, then the longest, then the most watched. None: null.
 */
export function matchFilmUpload(query: FilmMatchQuery, candidates: readonly FilmUploadCandidate[]): FilmUploadCandidate | null {
  const queryKeys = query.titles.map(filmTitleKeys).filter((keys) => keys.ar.length > 0 || keys.latin.length > 0)
  if (queryKeys.length === 0) return null
  const queryTokenCount = Math.max(...queryKeys.map((keys) => keys.ar.length + keys.latin.length))

  let best: FilmUploadCandidate | null = null
  let bestScore: [number, number, number] = [Infinity, -1, -1] // [extra words, year match, views]

  for (const candidate of candidates) {
    if (typeof candidate.duration !== 'number' || candidate.duration < MIN_FILM_SECONDS) continue
    if (CLIP_WORDS.test(candidate.title)) continue
    const tokens = filmTokens(candidate.title)
    const tokenSet = new Set(tokens)
    if (!queryKeys.some((keys) => titleMatches(keys, tokenSet))) continue

    const candidateYear = yearIn(candidate.title)
    if (query.year && candidateYear && Math.abs(candidateYear - query.year) > 1) continue

    const extra = Math.max(0, tokens.length - queryTokenCount)
    const yearMatch = query.year && candidateYear && Math.abs(candidateYear - query.year) <= 1 ? 1 : 0
    const score: [number, number, number] = [extra, yearMatch, candidate.views ?? 0]
    const better = score[0] < bestScore[0]
      || (score[0] === bestScore[0] && score[1] > bestScore[1])
      || (score[0] === bestScore[0] && score[1] === bestScore[1] && (candidate.duration ?? 0) > (best?.duration ?? 0))
      || (score[0] === bestScore[0] && score[1] === bestScore[1] && (candidate.duration ?? 0) === (best?.duration ?? 0) && score[2] > bestScore[2])
    if (better) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

// ---- legal Tunisian platforms (honest outbound links, never embedding) -------------------------

export type LegalPlatform = 'artify' | 'raksha'
export type LegalLink = { platform: LegalPlatform, url: string }

/** The platforms' display names (their own brand, shown in every language). */
export const LEGAL_PLATFORM_NAMES: Record<LegalPlatform, string> = { artify: 'Artify', raksha: 'Raksha' }

/** A platform's own hosts: a link is only ever to the platform it claims to be. */
const PLATFORM_HOST: Record<LegalPlatform, RegExp> = {
  artify: /^(?:www\.)?artify\.tn$/i,
  raksha: /^(?:www\.)?raksha\.tn$/i,
}

/** A legal link whose URL really is that platform's, over https; null otherwise. */
export function normalizeLegalLink(link: LegalLink | null | undefined): LegalLink | null {
  if (!link || !(link.platform in PLATFORM_HOST)) return null
  try {
    const url = new URL(link.url)
    return url.protocol === 'https:' && PLATFORM_HOST[link.platform].test(url.host) ? { platform: link.platform, url: url.toString() } : null
  } catch {
    return null
  }
}

/** A film's source pinned by hand (verified), keyed by `tmdb:<id>` or `slug:<year/month/slug>`. */
export type CuratedFilmSource = {
  /** A verified full upload on a trusted channel: used ahead of the live search. */
  youtube?: { id: string, channel: string }
  /** The film's page on a legal platform (verified it's there). */
  legal?: LegalLink
}

/**
 * Hand-verified film sources. Empty on purpose: entries are added only once checked, so nothing here
 * ever claims a film can be watched where it can't. Keyed by TMDB id (stable) or the blog slug.
 */
export const CURATED_FILM_SOURCES: Record<string, CuratedFilmSource> = {}

/** The curated source for a film, by its keys (`tmdb:…` preferred, then `slug:…`). */
export function curatedFilmSource(keys: readonly string[], map: Record<string, CuratedFilmSource> = CURATED_FILM_SOURCES): CuratedFilmSource | null {
  for (const key of keys) {
    const found = map[key]
    if (found) return found
  }
  return null
}

/** The legal link for a film, by its keys; validated so it only ever points at the platform it names. */
export function legalWatchLink(keys: readonly string[], map: Record<string, CuratedFilmSource> = CURATED_FILM_SOURCES): LegalLink | null {
  return normalizeLegalLink(curatedFilmSource(keys, map)?.legal)
}
