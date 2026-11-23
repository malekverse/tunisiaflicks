// "Guess the film from its music" (/guess/music): one film a day, the same for everyone, named from
// a piece of its soundtrack (Deezer's 30-second preview). The first try hears one second; every
// wrong guess or skip lets you hear more (1, 2, 4, 8, 15, then all 30 seconds) and unlocks a clue
// (the decade, the genres, the year and the composer, the cast, a line of the story). Six tries.
// The games, guesses, hints and stats are Guess the film's (lib/guess); these are the music's own
// rules: its days and numbers, the clip lengths, and which track of the album a day plays. Pure.
import { addDays, isDay, tunisDay, ARCHIVE_DAYS, MAX_TRIES, type Stage } from '@/src/lib/guess'

/** Puzzle #1 of the music game. */
export const MUSIC_EPOCH = '2026-11-23'
/** Its games' place on the device (lib/guess's Game, per day and pool). */
export const MUSIC_STORAGE_KEY = 'tf-guess-music:v1'

const MS_DAY = 86_400_000
const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))

export const musicDayNumber = (day: string) => Math.round((utc(day) - utc(MUSIC_EPOCH)) / MS_DAY)
export const musicNumber = (day: string) => musicDayNumber(day) + 1
export const isPlayableMusicDay = (day: string, today: string = tunisDay()) => isDay(day) && day >= MUSIC_EPOCH && day <= today

/** The archive, newest first, back to #1 (at most ARCHIVE_DAYS). */
export function musicArchiveDays(today: string = tunisDay()): string[] {
  const days: string[] = []
  for (let day = today; day >= MUSIC_EPOCH && days.length < ARCHIVE_DAYS; day = addDays(day, -1)) days.push(day)
  return days
}

/** How many seconds of the track each stage lets you hear. */
export const CLIP_SECONDS: Record<Stage, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 15, 6: 30 }
export const PREVIEW_SECONDS = 30
export const clipFor = (stage: Stage) => CLIP_SECONDS[stage]
/** The clip lengths in order, for the bar that shows them. */
export const CLIPS = Array.from({ length: MAX_TRIES }, (_, index) => CLIP_SECONDS[(index + 1) as Stage])

// ---------------------------------------------------------------------------------------------
// Which track

export type TrackChoice = { id: number, title: string, explicit: boolean, hasPreview: boolean, duration: number }

const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
// The film's theme, by its usual names on a soundtrack album.
const THEME = /\b(main titles?|main theme|theme from|theme|opening( titles)?|prologue|overture|suite|generique|thème|ouverture)\b/
// Not music to guess from: dialogue excerpts, interviews, bonus chatter.
const NOT_MUSIC = /\b(dialogue|interview|commentary|trailer|spoken|karaoke|instrumental version)\b/

/**
 * The track a day plays: one with a preview and no explicit lyrics, at least 40 seconds long (so
 * the preview is music, not a sting). The film's theme first ("Main Title", "Theme from…", a
 * track named after the film), else the first good one, else any with a preview. Null for none.
 */
export function pickTrack(tracks: readonly TrackChoice[], titles: readonly string[]): TrackChoice | null {
  const playable = tracks.filter((track) => track.hasPreview && !track.explicit && !NOT_MUSIC.test(fold(track.title)))
  if (!playable.length) return null
  const long = playable.filter((track) => !track.duration || track.duration >= 40)
  const pool = long.length ? long : playable
  const names = titles.map(fold).map((title) => title.replace(/[^\p{L}\p{N} ]+/gu, ' ').trim()).filter((title) => title.length >= 3)
  const theme = pool.find((track) => THEME.test(fold(track.title)))
  if (theme) return theme
  const named = pool.find((track) => names.some((name) => fold(track.title).includes(name)))
  return named ?? pool[0]
}

/** The share's first line ("TunisiaFlicks 🎵 #3"). */
export const musicHeading = (day: string) => `TunisiaFlicks 🎵 #${musicNumber(day)}`
