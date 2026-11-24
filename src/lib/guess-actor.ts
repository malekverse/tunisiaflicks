// "Guess the actor" (/guess/actor): one actor a day, the same for everyone, named from their face.
// The first try sees it heavily blurred; every wrong guess or skip sharpens it and unlocks a clue
// (the decade they were born in, where, their initials, a film they're in, their best-known films).
// Six tries. The games, stats and archive are Guess the film's (lib/guess); these are the actor's
// own rules: its days and numbers, how blurred each stage is, and which actor of a film a day gets.
// Pure, so it's unit-tested.
import { addDays, isDay, tunisDay, ARCHIVE_DAYS, type Stage } from '@/src/lib/guess'

/** Puzzle #1 of the actor game. */
export const ACTOR_EPOCH = '2026-11-24'
/** Its games' place on the device (lib/guess's Game, per day and pool). */
export const ACTOR_STORAGE_KEY = 'tf-guess-actor:v1'

const MS_DAY = 86_400_000
const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

export const actorDayNumber = (day: string) => Math.round((utc(day) - utc(ACTOR_EPOCH)) / MS_DAY)
export const actorNumber = (day: string) => actorDayNumber(day) + 1
export const isPlayableActorDay = (day: string, today: string = tunisDay()) => isDay(day) && day >= ACTOR_EPOCH && day <= today

/** The archive, newest first, back to #1 (at most ARCHIVE_DAYS). */
export function actorArchiveDays(today: string = tunisDay()): string[] {
  const days: string[] = []
  for (let day = today; day >= ACTOR_EPOCH && days.length < ARCHIVE_DAYS; day = addDays(day, -1)) days.push(day)
  return days
}

/** How the face looks at each stage: the blur (in % of the picture's width) and the zoom. */
export const FACE: Record<Stage, { blur: number, zoom: number, gray: boolean }> = {
  1: { blur: 9, zoom: 1.5, gray: true },
  2: { blur: 6.5, zoom: 1.4, gray: true },
  3: { blur: 4.5, zoom: 1.3, gray: false },
  4: { blur: 3, zoom: 1.2, gray: false },
  5: { blur: 1.6, zoom: 1.1, gray: false },
  6: { blur: 0, zoom: 1, gray: false },
}

/** "Denzel Washington" → "D. W."; one word → "C."; nothing usable → "". */
export function initialsOf(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((word) => Array.from(word.replace(/^[^\p{L}]+/u, ''))[0])
    .filter((letter): letter is string => !!letter && /\p{L}/u.test(letter))
    .slice(0, 3)
    .map((letter) => `${letter.toLocaleUpperCase()}.`)
    .join(' ')
}

/** The country of a place of birth as TMDB writes it ("Mount Vernon, New York, USA" → "USA"). */
export function birthCountry(place: unknown): string | null {
  if (typeof place !== 'string') return null
  const last = place.split(',').map((part) => part.trim()).filter(Boolean).pop()
  return last && last.length <= 40 ? last.replace(/^(?:now|present-day)\s+/i, '') : null
}

export type CastChoice = { id: number, name: string, profile_path: string | null, known_for_department?: string, order?: number, popularity?: number }

/**
 * The actor a film gives the day: among its first three billed, the first with a face to show who
 * is an actor (not a voice in a cartoon, see the server) and hasn't been a puzzle yet. Null for none.
 */
export function pickActor(cast: readonly CastChoice[], used: ReadonlySet<number>): CastChoice | null {
  const top = [...cast]
    .filter((member) => Number.isInteger(member.id) && member.name)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 3)
  return top.find((member) => member.profile_path && (member.known_for_department ?? 'Acting') === 'Acting' && !used.has(member.id)) ?? null
}

/** The share's first line ("TunisiaFlicks 🎭 #3"). */
export const actorHeading = (day: string) => `TunisiaFlicks 🎭 #${actorNumber(day)}`
