// Guess the film keeps its games on this device (localStorage): each day's guesses, so a reload
// or a locked screen picks up where you were, and the stats. Nothing goes to the server.
import { ARCHIVE_DAYS, isDay, isGuessPool, MAX_TRIES, type Entry, type Game, type GuessPool } from '@/src/lib/guess'

const KEY = 'tf-guess:v1'
/** Games kept: a little more than the archive shows. */
const KEEP = ARCHIVE_DAYS * 3 + 30

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

function cleanEntry(raw: any): Entry | null {
  if (raw?.kind === 'skip') return { kind: 'skip' }
  if (raw?.kind !== 'guess' || !Number.isInteger(raw.id) || typeof raw.title !== 'string') return null
  const hint = raw.hint && typeof raw.hint === 'object'
    ? {
      year: raw.hint.year === 'newer' || raw.hint.year === 'older' || raw.hint.year === 'same' ? raw.hint.year : null,
      genres: Array.isArray(raw.hint.genres) ? raw.hint.genres.filter(Number.isInteger) : [],
    }
    : null
  return {
    kind: 'guess',
    id: raw.id,
    title: raw.title.slice(0, 200),
    year: num(raw.year),
    poster_path: typeof raw.poster_path === 'string' ? raw.poster_path : null,
    right: raw.right === true,
    hint,
  }
}

export function loadGames(): Game[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap((game: any): Game[] => {
      if (!game || !isDay(game.day) || !isGuessPool(game.pool) || !Array.isArray(game.entries)) return []
      const entries = game.entries.map(cleanEntry).filter((entry: Entry | null): entry is Entry => !!entry).slice(0, MAX_TRIES)
      return [{ day: game.day, pool: game.pool, entries, finishedOn: isDay(game.finishedOn) ? game.finishedOn : null }]
    })
  } catch {
    return []
  }
}

export function saveGame(game: Game): Game[] {
  const games = loadGames().filter((other) => !(other.day === game.day && other.pool === game.pool))
  const next = [game, ...games].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, KEEP)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: this visit only */ }
  return next
}

export const findGame = (games: readonly Game[], day: string, pool: GuessPool) => games.find((game) => game.day === day && game.pool === pool) ?? null
