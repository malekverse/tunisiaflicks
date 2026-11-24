// "Guess the film" (/guess): one film a day, the same for everyone (by the day in Tunis). A still
// shows first, tightly cropped; every wrong guess or skip reveals a bit more (the full still, the
// decade, the genres, a second still and the year, the cast, a line of the story). Six tries.
// These are the pure rules: the days and their numbers, which film of the pool a day gets, the
// clues, the hints a wrong guess earns, the stats and the result to share. No React, no storage,
// no server (tests/guess.unit.test.mts). The puzzle itself comes from /api/guess/[day].

/** Puzzle #1. Archive days before it don't exist. */
export const GUESS_EPOCH = '2026-11-22'
export const MAX_TRIES = 6
/** How far back the archive goes. */
export const ARCHIVE_DAYS = 60

/** Which films the puzzle comes from: everyone's, a Kids profile's (G/PG), or Halal mode's. */
export type GuessPool = 'all' | 'kids' | 'halal'
export const GUESS_POOLS: GuessPool[] = ['all', 'kids', 'halal']
export const isGuessPool = (value: unknown): value is GuessPool => value === 'all' || value === 'kids' || value === 'halal'

/** The puzzle's text comes in three languages (Derja reads the Arabic one). */
export type GuessLanguage = 'en' | 'fr' | 'ar'
export const isGuessLanguage = (value: unknown): value is GuessLanguage => value === 'en' || value === 'fr' || value === 'ar'

// ---------------------------------------------------------------------------------------------
// Days

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MS_DAY = 86_400_000

/** Today in Tunis, as YYYY-MM-DD: when a new puzzle starts, for everyone. */
export function tunisDay(now: Date = new Date()): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

/** A real calendar day written YYYY-MM-DD. */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false
  return new Date(utc(value)).toISOString().slice(0, 10) === value
}

/** Days since puzzle #1 (0 for #1). */
export const dayNumber = (day: string) => Math.round((utc(day) - utc(GUESS_EPOCH)) / MS_DAY)
export const dayFromNumber = (n: number) => new Date(utc(GUESS_EPOCH) + n * MS_DAY).toISOString().slice(0, 10)
export const addDays = (day: string, offset: number) => new Date(utc(day) + offset * MS_DAY).toISOString().slice(0, 10)
/** The number shown and shared ("#12"). */
export const puzzleNumber = (day: string) => dayNumber(day) + 1

/** Whether a day has a puzzle yet: from #1 to today in Tunis. */
export const isPlayableDay = (day: string, today: string = tunisDay()) => isDay(day) && day >= GUESS_EPOCH && day <= today

/** The archive, newest first: today and the days before it, back to #1 (at most ARCHIVE_DAYS). */
export function archiveDays(today: string = tunisDay()): string[] {
  const days: string[] = []
  for (let n = dayNumber(today); n >= 0 && days.length < ARCHIVE_DAYS; n--) days.push(dayFromNumber(n))
  return days
}

/** When the next puzzle starts (midnight in Tunis), in ms since the epoch. */
export function nextPuzzleAt(now: Date = new Date()): number {
  const tomorrow = addDays(tunisDay(now), 1)
  // Tunis is UTC+1 all year (no summer time since 2009): midnight there is 23:00 UTC the day before.
  return utc(tomorrow) - 60 * 60 * 1000
}

// ---------------------------------------------------------------------------------------------
// Which film

const STEP = 211

/**
 * The film a day gets from a pool of `size` films: a walk that visits every film once before any
 * comes back (STEP shares no factor with the size), skipping films already used (`used`). The
 * server locks the answer in once chosen, so a pool that shifts later never changes a past day.
 */
export function pickIndex(n: number, size: number, used: (index: number) => boolean = () => false): number {
  if (size <= 0) return -1
  const step = gcd(STEP, size) === 1 ? STEP : 1
  const start = (((n * step + 37) % size) + size) % size
  for (let offset = 0; offset < size; offset++) {
    const index = (start + offset) % size
    if (!used(index)) return index
  }
  return start
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

/** Where the first, tight crop of the still looks (percent of the frame): the same all day. */
export function focalPoint(day: string, salt = 0): { x: number, y: number } {
  let hash = 2166136261
  for (const char of `${day}:${salt}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return { x: 28 + (hash % 45), y: 30 + ((hash >>> 8) % 41) }
}

// ---------------------------------------------------------------------------------------------
// The clues

/**
 * What the board shows, by stage (1 to 6; one stage more for every wrong guess or skip):
 * 1 the still, cropped tight; 2 a wider crop and the decade; 3 the whole still, the genres and the
 * running time; 4 a second still, the year, the country and the director; 5 the cast; 6 a line of
 * the story, the title's words blacked out.
 */
export type Stage = 1 | 2 | 3 | 4 | 5 | 6

export const stageFor = (misses: number, finished: boolean): Stage => (finished ? 6 : (Math.min(MAX_TRIES, misses + 1) as Stage))

/** How the still is framed at each stage: zoom and which still (0 or 1). */
export const FRAMING: Record<Stage, { zoom: number, still: 0 | 1 }> = {
  1: { zoom: 3.4, still: 0 },
  2: { zoom: 1.8, still: 0 },
  3: { zoom: 1, still: 0 },
  4: { zoom: 1, still: 1 },
  5: { zoom: 1, still: 1 },
  6: { zoom: 1, still: 1 },
}

export const decadeOf = (year: number) => Math.floor(year / 10) * 10

export type Segment = { text: string, masked: boolean }

const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()

// Little words a title shares with every sentence: never blacked out.
const KEEP = new Set([
  'the', 'and', 'for', 'with', 'from', 'les', 'des', 'une', 'aux', 'dans', 'pour', 'sur', 'del', 'los', 'las', 'der', 'die', 'das', 'und',
  'من', 'في', 'على', 'الى', 'إلى', 'عن',
])

/** The title's words worth hiding: three letters or more, not a little word. */
export function titleWords(titles: readonly string[]): Set<string> {
  const words = new Set<string>()
  for (const title of titles) {
    for (const word of fold(title).split(/[^\p{L}\p{N}]+/u)) {
      if (Array.from(word).length >= 3 && !KEEP.has(word)) words.add(word)
    }
  }
  return words
}

/**
 * `text` in segments, with every word of the title (in any of its languages) blacked out, so the
 * story's line doesn't give the name away. Words keep their punctuation and spacing.
 */
export function maskTitle(text: string, titles: readonly string[]): Segment[] {
  const hidden = titleWords(titles)
  const segments: Segment[] = []
  const push = (part: string, masked: boolean) => {
    const last = segments[segments.length - 1]
    if (last && last.masked === masked && !masked) last.text += part
    else segments.push({ text: part, masked })
  }
  for (const part of text.split(/([\p{L}\p{N}]+)/u)) {
    if (!part) continue
    const isWord = /^[\p{L}\p{N}]+$/u.test(part)
    // A word that starts with one of the title's words ("Gump's", "Nemo") goes too.
    const masked = isWord && [...hidden].some((word) => fold(part) === word || (fold(part).startsWith(word) && fold(part).length - word.length <= 2))
    push(part, masked)
  }
  return segments
}

/** The first sentence or two of an overview, up to about `max` characters. */
export function storyLine(overview: string, max = 220): string {
  const text = overview.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const sentences = text.match(/[^.!?؟]+[.!?؟]+(\s|$)/gu) ?? []
  let out = ''
  for (const sentence of sentences) {
    if ((out + sentence).length > max) break
    out += sentence
  }
  if (out.trim()) return out.trim()
  const cut = text.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trim()}…`
}

// ---------------------------------------------------------------------------------------------
// A guess

/** A film someone guessed, as the search found it (or, in Guess the actor, a person: `note` says what they're known for). */
export type Candidate = { id: number, title: string, year: number | null, genre_ids: number[], poster_path: string | null, note?: string }

/** The answer the client checks guesses against. */
export type Answer = { id: number, title: string, original_title: string, year: number | null, genre_ids: number[], poster_path: string | null, backdrop_path: string | null }

export type Entry =
  | { kind: 'skip' }
  | { kind: 'guess', id: number, title: string, year: number | null, poster_path: string | null, right: boolean, hint: Hint | null }

/** What a wrong guess tells you: is the film newer or older, and which genres you got right. */
export type Hint = { year: 'newer' | 'older' | 'same' | null, genres: number[] }

export function hintFor(guess: Pick<Candidate, 'year' | 'genre_ids'>, answer: Pick<Answer, 'year' | 'genre_ids'>): Hint {
  const year = guess.year && answer.year ? (answer.year > guess.year ? 'newer' : answer.year < guess.year ? 'older' : 'same') : null
  const genres = guess.genre_ids.filter((id) => answer.genre_ids.includes(id))
  return { year, genres }
}

export function judge(guess: Candidate, answer: Answer): Entry {
  const right = guess.id === answer.id
  return { kind: 'guess', id: guess.id, title: guess.title, year: guess.year, poster_path: guess.poster_path, right, hint: right ? null : hintFor(guess, answer) }
}

// ---------------------------------------------------------------------------------------------
// A game and the stats

export type Game = {
  day: string
  pool: GuessPool
  entries: Entry[]
  /** The day it was finished (a past day played later doesn't count for the streak). */
  finishedOn: string | null
}

export type Outcome = 'won' | 'lost' | 'playing'

export function outcome(entries: readonly Entry[]): Outcome {
  if (entries.some((entry) => entry.kind === 'guess' && entry.right)) return 'won'
  return entries.length >= MAX_TRIES ? 'lost' : 'playing'
}

export const misses = (entries: readonly Entry[]) => entries.filter((entry) => !(entry.kind === 'guess' && entry.right)).length

/** Played on its own day: the only games the streak counts. */
const onTheDay = (game: Game) => game.finishedOn === game.day

export type Stats = { played: number, won: number, winRate: number, streak: number, best: number, distribution: number[] }

/**
 * The stats of one pool's games. The streak: films found on their own day, day after day, up to
 * today (or yesterday, while today's film is still open).
 */
export function stats(games: readonly Game[], today: string = tunisDay()): Stats {
  const finished = games.filter((game) => outcome(game.entries) !== 'playing')
  const won = finished.filter((game) => outcome(game.entries) === 'won')
  const distribution = Array.from({ length: MAX_TRIES }, () => 0)
  for (const game of won) distribution[game.entries.length - 1]++

  const wonOnTheDay = new Set(won.filter(onTheDay).map((game) => game.day))
  const byDay = new Map(games.map((game) => [game.day, game]))
  let streak = 0
  let day = today
  const todays = byDay.get(today)
  if (!todays || outcome(todays.entries) === 'playing') day = addDays(today, -1)
  while (wonOnTheDay.has(day)) {
    streak++
    day = addDays(day, -1)
  }

  let best = 0
  let run = 0
  let previous: string | null = null
  for (const current of [...wonOnTheDay].sort()) {
    run = previous && addDays(previous, 1) === current ? run + 1 : 1
    best = Math.max(best, run)
    previous = current
  }

  return {
    played: finished.length,
    won: won.length,
    winRate: finished.length ? Math.round((won.length / finished.length) * 100) : 0,
    streak,
    best: Math.max(best, streak),
    distribution,
  }
}

/** The result to paste in a chat: the number, the score and one square per try (no spoilers). */
export function shareText(day: string, entries: readonly Entry[], url: string, heading = `TunisiaFlicks #${puzzleNumber(day)}`): string {
  const result = outcome(entries)
  const score = result === 'won' ? `${entries.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`
  const squares = Array.from({ length: MAX_TRIES }, (_, index) => {
    const entry = entries[index]
    if (!entry) return '⬜'
    if (entry.kind === 'skip') return '⬛'
    return entry.right ? '🟩' : '🟥'
  })
  return `${heading} ${score}\n${squares.join('')}\n${url}`
}

// ---------------------------------------------------------------------------------------------
// The answer, wrapped so it doesn't sit in plain text in the page (a glance at the network tab or
// a link preview shouldn't spoil it; anyone set on cheating can, it's a game among friends).

export function wrapAnswer(answer: Answer): string {
  const bytes = new TextEncoder().encode(JSON.stringify(answer))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte ^ 0x5a)
  return btoa(binary).split('').reverse().join('')
}

export function unwrapAnswer(wrapped: string): Answer | null {
  try {
    const binary = atob(wrapped.split('').reverse().join(''))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0) ^ 0x5a)
    const value = JSON.parse(new TextDecoder().decode(bytes))
    return typeof value?.id === 'number' && typeof value?.title === 'string' ? value as Answer : null
  } catch {
    return null
  }
}
