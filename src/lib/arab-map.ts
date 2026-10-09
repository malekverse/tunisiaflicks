// The Arab cinema map's geometry: the 22 Arab League members as tiles on a 9×5 grid, roughly where
// they sit on a real map (west to east, north to south), and what the keyboard, the ripple and the
// neighbour chips do with it. Pure helpers, safe on the server and the client (no data here).
//
// The grid is always laid out left to right, in every language: it is a map, and maps don't mirror.
import type { ArabCountryCode } from '@/src/lib/arab-countries'

export const MAP_COLUMNS = 9
export const MAP_ROWS = 5

export type MapCell = { code: ArabCountryCode, x: number, y: number }

/** Every tile, row by row (reading order of the grid, which is also the tab and D-pad fallback). */
export const MAP_CELLS: readonly MapCell[] = [
  { code: 'ma', x: 0, y: 0 }, { code: 'dz', x: 1, y: 0 }, { code: 'tn', x: 2, y: 0 },
  { code: 'lb', x: 4, y: 0 }, { code: 'sy', x: 5, y: 0 }, { code: 'iq', x: 6, y: 0 }, { code: 'kw', x: 7, y: 0 },
  { code: 'mr', x: 0, y: 1 }, { code: 'ly', x: 2, y: 1 }, { code: 'eg', x: 3, y: 1 }, { code: 'ps', x: 4, y: 1 },
  { code: 'jo', x: 5, y: 1 }, { code: 'sa', x: 6, y: 1 }, { code: 'bh', x: 7, y: 1 }, { code: 'qa', x: 8, y: 1 },
  { code: 'sd', x: 3, y: 2 }, { code: 'ye', x: 6, y: 2 }, { code: 'ae', x: 7, y: 2 }, { code: 'om', x: 8, y: 2 },
  { code: 'dj', x: 5, y: 3 }, { code: 'so', x: 6, y: 3 },
  { code: 'km', x: 6, y: 4 },
]

const BY_CODE = new Map(MAP_CELLS.map((cell) => [cell.code, cell]))

export function cellOf(code: ArabCountryCode): MapCell {
  return BY_CODE.get(code)!
}

/** The map's own colour: desert sand ('r g b'), the same as the Arab cinema door on the home page. */
export const MAP_ACCENT = '200 162 122'

/** Where the entrance ripple starts. */
export const MAP_ORIGIN: ArabCountryCode = 'tn'

/** Grid distance from Tunisia: the entrance ripple reaches a tile after 40ms per step. */
export function rippleDistance(code: ArabCountryCode): number {
  const from = cellOf(MAP_ORIGIN)
  const to = cellOf(code)
  return Math.hypot(to.x - from.x, to.y - from.y)
}

/** The ripple delay of a tile, in milliseconds. */
export const rippleDelay = (code: ArabCountryCode) => Math.round(40 * rippleDistance(code))

/**
 * How lit a tile is (0 to 1) for `n` titles on record: log scale, so a country with 40 titles
 * still glows next to one with 4,000; 5,000 or more is full.
 */
export function intensity(n: number | null | undefined): number {
  if (!n || n <= 0) return 0
  return Math.min(1, Math.log10(n + 1) / Math.log10(5000))
}

/**
 * The poster's opacity on a tile at rest. Rounded: the server's and the browser's Math.log10 can
 * differ in the last digit, and the value is written into the HTML.
 */
export const posterOpacity = (n: number | null | undefined) => Math.round((0.14 + 0.26 * intensity(n)) * 1000) / 1000

export type Direction = 'left' | 'right' | 'up' | 'down'

/**
 * The tile an arrow key moves to: the nearest one in the half-plane the arrow points at, scored
 * by the distance along the arrow plus twice the distance across it (so a tile straight ahead
 * beats a closer one off to the side). Ties go to the nearer tile, then to the east or south one.
 * Null at the edge of the map (nothing that way).
 */
export function step(from: ArabCountryCode, direction: Direction): ArabCountryCode | null {
  const origin = cellOf(from)
  const horizontal = direction === 'left' || direction === 'right'
  const sign = direction === 'right' || direction === 'down' ? 1 : -1
  let best: { code: ArabCountryCode, score: number, distance: number, across: number } | null = null
  for (const cell of MAP_CELLS) {
    const dx = cell.x - origin.x
    const dy = cell.y - origin.y
    const along = (horizontal ? dx : dy) * sign
    if (along <= 0) continue
    const across = horizontal ? dy : dx
    const score = along + 2 * Math.abs(across)
    const distance = Math.hypot(dx, dy)
    if (
      !best
      || score < best.score
      || (score === best.score && distance < best.distance)
      || (score === best.score && distance === best.distance && across > best.across)
    ) {
      best = { code: cell.code, score, distance, across }
    }
  }
  return best?.code ?? null
}

/** Home and End on the map: the first tile (Morocco) and the last (Comoros). */
export const FIRST_TILE: ArabCountryCode = 'ma'
export const LAST_TILE: ArabCountryCode = 'km'

/**
 * Each country's nearest Arab neighbours, nearest first (land borders, then across a strait or a
 * short stretch of sea). At most four: the chip row on a country's page.
 */
const NEIGHBOURS: Record<ArabCountryCode, readonly ArabCountryCode[]> = {
  ma: ['dz', 'mr', 'tn'],
  dz: ['ma', 'tn', 'ly', 'mr'],
  tn: ['dz', 'ly', 'ma', 'eg'],
  ly: ['tn', 'eg', 'dz', 'sd'],
  eg: ['ly', 'sd', 'ps', 'jo'],
  mr: ['ma', 'dz'],
  sd: ['eg', 'ly', 'sa', 'ye'],
  ps: ['jo', 'eg', 'lb', 'sy'],
  lb: ['sy', 'ps', 'jo'],
  sy: ['lb', 'iq', 'jo', 'ps'],
  iq: ['sy', 'jo', 'kw', 'sa'],
  jo: ['ps', 'sy', 'iq', 'sa'],
  sa: ['jo', 'iq', 'ye', 'ae'],
  kw: ['iq', 'sa', 'bh'],
  bh: ['sa', 'qa', 'kw'],
  qa: ['sa', 'bh', 'ae'],
  ae: ['om', 'sa', 'qa'],
  om: ['ae', 'ye', 'sa'],
  ye: ['sa', 'om', 'dj', 'so'],
  dj: ['so', 'ye'],
  so: ['dj', 'ye', 'km'],
  km: ['so', 'dj'],
}

export function neighbours(code: ArabCountryCode, limit = 4): ArabCountryCode[] {
  return NEIGHBOURS[code].slice(0, limit)
}

// ---------------------------------------------------------------------------------------------
// Names: sorting and typing to find a country.

const ARTICLE = /^\s*ال(?=\S)/u
const MARKS = /\p{M}/gu

/**
 * A name as typeahead and sorting see it: without the Arabic article ('المغرب' → 'مغرب'), accents,
 * hamza seats and short vowels ('Égypte' → 'egypte', 'الإمارات' → 'امارات'), in lower case.
 */
export function foldName(name: string): string {
  return name
    .replace(ARTICLE, '')
    .normalize('NFD')
    .replace(MARKS, '')
    // Alef variants and the tatweel that NFD leaves alone.
    .replace(/[ٱٲٳ]/g, 'ا')
    .replace(/ـ/g, '')
    .toLocaleLowerCase('en')
    .trim()
}

/** Countries in alphabetical order of their names in `lang`, 'ال' set aside ('الأردن' sorts under أ). */
export function sortByName<T extends { name: string }>(items: readonly T[], lang: string): T[] {
  let collator: Intl.Collator
  try {
    collator = new Intl.Collator(lang, { sensitivity: 'base', ignorePunctuation: true })
  } catch {
    collator = new Intl.Collator('en', { sensitivity: 'base' })
  }
  const key = (name: string) => name.replace(ARTICLE, '')
  return [...items].sort((a, b) => collator.compare(key(a.name), key(b.name)))
}

/**
 * Typeahead: the country whose name (any of `names`, folded) starts with what was typed. A single
 * repeated letter cycles through the matches after `current`; a longer word starts from `current`.
 */
export function typeahead(
  typed: string,
  entries: readonly { code: ArabCountryCode, names: readonly string[] }[],
  current?: ArabCountryCode | null,
): ArabCountryCode | null {
  const query = foldName(typed)
  if (!query) return null
  const cycling = [...query].every((char) => char === query[0])
  const needle = cycling ? query[0] : query
  const start = current ? Math.max(0, entries.findIndex((entry) => entry.code === current)) : 0
  const offset = cycling && current ? 1 : 0
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[(start + offset + i) % entries.length]
    if (entry.names.some((name) => foldName(name).startsWith(needle))) return entry.code
  }
  return null
}
