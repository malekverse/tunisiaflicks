// Text handling for Ask, shared by the browser (the palette decides where "Ask" goes as you type)
// and the server (cache keys, span checks, scrubbing before anything reaches the model).
// No imports: keep it small, it ships in the palette.

/** The longest request Ask takes (the field's maxLength too). */
export const MAX_QUERY = 160

// Control and invisible formatting characters (bidi overrides, zero-width marks, BOM).
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f­؜​-‏‪-‮⁠-⁩﻿]/g

/** What was typed, made safe to handle: no control or bidi characters, single spaces, 160 chars at most. */
export function cleanInput(q: unknown): string {
  if (typeof q !== 'string') return ''
  return q.normalize('NFC').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY).trim()
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|tn|fr|me|co|tv|app|ly|info|biz|dz|ma|eg)\b(?:\/\S*)?/gi
// International numbers (+216 22 123 456, 0033 6 12 34 56 78), then the Tunisian 8 digits
// (22 123 456, 98-765-432, 71123456), then the North American 3-3-4 shape.
const PHONE_INTL = /(?:\+|\b00)\d[\d\s().-]{6,}\d/g
const PHONE_TN = /\b[2-9]\d(?:[\s.-]?\d{3}){2}\b/g
const PHONE_NA = /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g

/**
 * Removes what could identify someone before a request is stored or sent to the model: e-mail
 * addresses, links and phone numbers. What remains is cleaned again.
 */
export function scrubPersonal(q: string): string {
  return cleanInput(String(q ?? '')
    .replace(EMAIL, ' ')
    .replace(URL_LIKE, ' ')
    .replace(PHONE_INTL, ' ')
    .replace(PHONE_TN, ' ')
    .replace(PHONE_NA, ' '))
}

/**
 * The comparable form of a request: lowercase, no accents, Arabic letters unified (hamza forms,
 * alef maqsura, ta marbuta, tatweel, harakat), punctuation and hyphens as spaces. Cache keys and
 * span checks use it. Arabizi digits (3, 7, 9) are kept.
 */
export function normalizeQuery(q: string): string {
  return cleanInput(q)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـۡ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Words in a request. */
export function wordCount(q: string): number {
  const text = normalizeQuery(q)
  return text ? text.split(' ').length : 0
}

/** Whether `span` was really typed: it must appear in the request (compared in normalized form). */
export function isOwnSpan(query: string, span: unknown): boolean {
  if (typeof span !== 'string') return false
  const needle = normalizeQuery(span)
  if (!needle) return false
  return normalizeQuery(query).includes(needle)
}

// What makes a request read like a description rather than a title. Written naturally, compared
// in normalized form (see the end of the lists). Each list scores once per word; see askScore.
const words = (text: string) => text.split(/\s+/).map(normalizeQuery).filter(Boolean)
const CUES = new Set(words(
  // moods and genres
  'funny hilarious comedy comedies romantic romcom scary horror creepy thriller thrillers action drama dramas animated cartoon cartoons anime ' +
  'documentary documentaries scifi fantasy mystery crime war western heartwarming uplifting emotional inspiring sad gritty twist heist ' +
  'zombie zombies vampire vampires superhero superheroes dystopian cozy relaxing mindless ' +
  // quality, time, length
  'best greatest underrated acclaimed classic classics recent latest short long tonight ' +
  // where from
  'korean turkish egyptian tunisian french japanese indian bollywood american british spanish italian chinese arab arabic moroccan algerian ' +
  'syrian lebanese saudi nordic scandinavian german mexican brazilian iranian ' +
  // French
  'drole droles marrant comedie comedies horreur peur effrayant romantique policier anime animation documentaire guerre familial famille ' +
  'meilleur meilleurs meilleures recents court courts coreen coreens coreenne coreennes turc turcs turque turques egyptien egyptiens ' +
  'egyptienne egyptiennes tunisien tunisiens tunisienne tunisiennes japonais indien arabe amour reconfortant reconfortante annees ' +
  // Arabic and Derja (normalized: no hamza, ta marbuta as ha)
  'مضحك مضحكة كوميدي كوميدية كوميديا رعب مرعب رومانسي رومانسية حب اكشن أكشن إثارة تشويق دراما وثائقي وثائقية كرتون خيال حرب جريمة ' +
  'عائلي عائلية أفضل أحسن جديد جديدة قديم قديمة قصير قصيرة كوري كورية تركي تركية مصري مصرية تونسي تونسية هندي عربي عربية مغربي جزائري ' +
  'سوري لبناني تضحك يضحك يخوف تخوف مريح التسعينات الثمانينات السبعينات الستينات ' +
  // Arabizi
  'mod7ik mode7 dhe7k ra3b romansi akchn kouri torki masri tounsi jdid a7sen'
))
// Phrases that count as one cue.
const CUE_PHRASES = ['feel good', 'sci fi', 'science fiction', 'time travel', 'true story', 'love story', 'love stories', 'histoire d amour', 'histoires d amour', 'voyage dans le temps', 'رسوم متحركة', 'خيال علمي'].map(normalizeQuery)

const KIND_WORDS = new Set(words('movie movies film films series show shows tv serie filme فيلم أفلام افلام مسلسل مسلسلات msalsel aflem'))

// Openers that ask for something ("I want", "show me", "نحب نشوف"...).
const STARTERS = [
  'i want', 'i wanna', 'i d like', 'show me', 'give me', 'find me', 'recommend', 'suggest', 'looking for', 'in the mood',
  'what to watch', 'what should i watch', 'anything', 'je veux', 'j aimerais', 'donne moi', 'montre moi', 'quelque chose', 'un film', 'une serie',
  'des films', 'نحب', 'حاب', 'نشوف', 'عطيني', 'اعطيني', 'أعطني', 'أريد', 'أبغى', 'أبي', 'حاجة', 'شيء', 'n7eb', 'nheb', 'nhb', '3tini', 'a3tini', 'famma', 'fama',
].map(normalizeQuery)
// Joining words that describe ("with", "set in", "like"...). Each counts once.
const LINKS = ['with', 'without', 'about', 'set in', 'for a', 'for the', 'but', 'not too', 'avec', 'sans', 'pour', 'mais', 'sur', 'مع', 'بدون', 'من غير', 'عن', 'لكن', 'أما', 'm3a', 'ama'].map(normalizeQuery)
// Comparisons: strong signals.
const LIKE = ['like', 'similar to', 'comme', 'genre de', 'مثل', 'كيف', 'kif', 'kima', 'كما'].map(normalizeQuery)

/** An Arabic word without its article or a joined preposition ('الأفلام' -> 'أفلام', 'بالعربي' -> 'عربي'). */
export function withoutArticle(word: string): string {
  const match = /^(?:وال|بال|فال|كال|لل|ال)(.{2,})$/.exec(word)
  return match ? match[1] : word
}
const inSet = (set: Set<string>, word: string) => set.has(word) || set.has(withoutArticle(word))

const has = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `)

/**
 * How much a request reads like a description of what to watch rather than a title. Cue words
 * (moods, genres, nationalities, decades) score 2 each (three at most); an opener ("show me",
 * "نحب") 3; a comparison ("like", "مثل") 2; joining words 1 each (two at most); starting with
 * "movies"/"films" 2; length 1 from three words and 1 more from six. Title shapes ("of the",
 * "and the", a sequel number, quotes) take points away. See looksLikeAsk.
 */
export function askScore(q: string): number {
  const raw = cleanInput(q)
  const text = normalizeQuery(raw)
  if (!text) return 0
  const tokens = text.split(' ')
  let score = 0

  if (tokens.length >= 3) score += 1
  if (tokens.length >= 6) score += 1

  let cues = 0
  for (const word of tokens) {
    if (inSet(CUES, word) || /^(?:19|20)?\d0s$/.test(word) || /^(?:19|20)\d\d$/.test(word)) cues += 1
  }
  cues += CUE_PHRASES.filter((phrase) => has(text, phrase)).length
  score += Math.min(cues, 3) * 2

  if (tokens.some((word) => inSet(KIND_WORDS, word))) score += 1
  if (inSet(KIND_WORDS, tokens[0]) && tokens.length >= 3) score += 2
  if (has(text, 'something')) score += 2
  if (STARTERS.some((phrase) => has(text, phrase))) score += 3
  if (LIKE.some((phrase) => has(text, phrase))) score += 2
  score += Math.min(LINKS.filter((phrase) => has(text, phrase)).length, 2)

  if (/ (?:of|and) the /.test(` ${text} `) || has(text, 'de la') || has(text, 'et le')) score -= 1
  if (/ (?:[2-9]|ii|iii|iv|vi)$/.test(text)) score -= 1
  if (/^["“«'].*["”»']$/.test(raw)) score -= 3
  return score
}

/**
 * Whether the palette should offer Ask first: at least three words that read like a description
 * (askScore 4 or more). "the lord of the rings" stays a title search.
 */
export function looksLikeAsk(q: string): boolean {
  return wordCount(q) >= 3 && askScore(q) >= 4
}
