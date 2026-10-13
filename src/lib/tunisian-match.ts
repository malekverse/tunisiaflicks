// Which Tunisian TV series (lib/tunisian-tv) a series of the Tunisian catalogue (lib/tunisian) is,
// for the series the source blog never added episodes to: their official uploads play instead.
// Pure, no I/O.
//
// The two name a series differently: the blog "مسلسل رڨوج الجزء الأول Ragouj", "Ragouj 2 مسلسل
// رقوج الكنز", "مسلسل باب البنات"; the channels "رقوج", "Warthet El Nar" / "ورثة النار", "باب بنات".
// Both are reduced to keys (one per script) and a series matches only on an identical key: a
// confident match or none.

const ARABIC = /[؀-ۿ]/
const LATIN = /[a-z]/

/** "Series" words in front of a name. */
const SERIES_WORDS = new Set(['مسلسل', 'سلسله', 'سيتكوم', 'سيتكوما', 'feuilleton', 'sitcom', 'serie', 'series', 'mosalsal', 'hd'])
/** Articles, dropped on both sides ("Bab El Bnet" / "Bab Bnet"). */
const ARTICLES = new Set(['el', 'al', 'l', 'le', 'la', 'les', 'ال'])
const PART_WORDS = new Set(['الجزء', 'جزء', 'الموسم', 'موسم', 'part', 'partie', 'saison', 'season'])
const ORDINALS: Record<string, number> = {
  الاول: 1, الاولي: 1, اول: 1, الثاني: 2, ثاني: 2, الثالث: 3, ثالث: 3, الرابع: 4, رابع: 4, الخامس: 5, خامس: 5,
}

/** Lower case, no diacritics or tashkeel, the Arabic letters that are written several ways folded. */
export function fold(text: string): string {
  return (text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // The Tunisian "g" (ڨ, also written ڭ or گ) is often written ق: "رڨوج" is "رقوج".
    .replace(/[ڨڭگ]/g, 'ق')
    .replace(/ڤ/g, 'ف')
    .replace(/پ/g, 'ب')
    .toLowerCase()
}

const tokensOf = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)

const NUMBER = /^\d{1,2}$/
const ROMAN: Record<string, number> = { ii: 2, iii: 3, iv: 4 }

/**
 * The part (season) a name says it is, or null: "الجزء الأول" 1, "الجزء 2" 2, "Ragouj 2" 2,
 * "Saison 3" 3, "S02" 2.
 */
export function partOf(name: string): number | null {
  const tokens = tokensOf(name)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const next = tokens[i + 1]
    if (PART_WORDS.has(token) && next !== undefined) {
      if (NUMBER.test(next)) return Number(next)
      if (ORDINALS[next]) return ORDINALS[next]
    }
    const short = /^s(\d{1,2})$/.exec(token)
    if (short) return Number(short[1])
  }
  // A number on its own, after a name: "Ragouj 2", "صاحبك راجل 2".
  for (let i = 1; i < tokens.length; i++) {
    if (NUMBER.test(tokens[i]) && !PART_WORDS.has(tokens[i - 1])) return Number(tokens[i])
    if (ROMAN[tokens[i]]) return ROMAN[tokens[i]]
  }
  return null
}

/**
 * What identifies a name, in each script it is written in: no series word, part, season or
 * number, no punctuation, no articles ("ال", "el"). "Ragouj 2 مسلسل رقوج الكنز" →
 * ["رقوج كنز", "ragouj"]; "مسلسل باب البنات" → ["باب بنات"].
 */
export function nameKeys(name: string): string[] {
  const tokens = tokensOf(name)
  const kept: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (SERIES_WORDS.has(token) || ARTICLES.has(token)) continue
    if (PART_WORDS.has(token)) {
      if (tokens[i + 1] !== undefined && (NUMBER.test(tokens[i + 1]) || ORDINALS[tokens[i + 1]])) i++
      continue
    }
    if (/^\d+$/.test(token) || /^s\d{1,2}$/.test(token) || ROMAN[token]) continue
    // The article on an Arabic word ("البنات" → "بنات"), when a word is left.
    kept.push(token.length > 3 && token.startsWith('ال') ? token.slice(2) : token)
  }
  const arabic = kept.filter((token) => ARABIC.test(token)).join(' ')
  const latin = kept.filter((token) => LATIN.test(token) && !ARABIC.test(token)).join(' ')
  // Too short to say anything ("x", "تو").
  return Array.from(new Set([arabic, latin])).filter((key) => key.replace(/\s/g, '').length >= 3)
}

/** A Tunisian TV series as the matching sees it: its names, and its playable episodes per season. */
export type TvMatchCandidate = {
  id: string
  title: string
  titleAlt: string | null
  /** Episodes that play here (not blocked, gone, clips or lives), by season ('1' when unnumbered). */
  seasons: Record<string, number>
}

/** Fewer episodes than this is a stray upload, not the series. */
export const MIN_EPISODES = 2

/** The candidate's episodes that a name asking for `part` would show (all of them without one). */
export function episodesFor(candidate: Pick<TvMatchCandidate, 'seasons'>, part: number | null): number {
  if (part !== null) return candidate.seasons[String(part)] ?? 0
  return Object.values(candidate.seasons).reduce((sum, count) => sum + count, 0)
}

/**
 * The Tunisian TV series a catalogue series is: one whose title or other title has the same key as
 * the catalogue's name, in either script, with enough episodes to watch (of the part the name asks
 * for, when it asks for one). Several (a series re-run on two channels): the one with the most
 * episodes. None: null.
 */
export function matchTvSeries<T extends TvMatchCandidate>(name: string, candidates: readonly T[]): T | null {
  const keys = new Set(nameKeys(name))
  if (keys.size === 0) return null
  const part = partOf(name)
  let best: T | null = null
  let bestCount = 0
  for (const candidate of candidates) {
    const names = [...nameKeys(candidate.title), ...nameKeys(candidate.titleAlt ?? '')]
    if (!names.some((key) => keys.has(key))) continue
    const count = episodesFor(candidate, part)
    if (count >= MIN_EPISODES && count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}
