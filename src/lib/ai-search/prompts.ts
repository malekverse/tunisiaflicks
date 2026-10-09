// The example questions shown where Ask starts (the palette's "Try asking", the empty Ask page):
// a few of the twelve ai.try.* strings, changing with the day in Tunis (and the hour, in the
// palette). Client-safe; the same on the server and in the browser for the same moment.

export const TRY_KEYS = Array.from({ length: 12 }, (_, index) => `ai.try.${index + 1}`)

/** Today's date and hour in Tunis ('2026-10-09', 21). */
export function tunisClock(now = new Date()): { day: string, hour: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now).map((part) => [part.type, part.value]))
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

/** FNV-1a: a small, stable string hash. */
export function seedHash(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/** `count` different prompt keys for a seed (consecutive steps of 5 through the twelve: all distinct). */
export function pickPrompts(count: number, seed: string): string[] {
  const start = seedHash(seed) % TRY_KEYS.length
  return Array.from({ length: Math.min(count, TRY_KEYS.length) }, (_, index) => TRY_KEYS[(start + index * 5) % TRY_KEYS.length])
}

/** The palette's two prompts: the day in Tunis plus the hour. */
export const hourlyPrompts = (count = 2, now = new Date()) => {
  const { day, hour } = tunisClock(now)
  return pickPrompts(count, `${day}:${hour}`)
}

/** The search page's three prompts: the day in Tunis. */
export const dailyPrompts = (count = 3, now = new Date()) => pickPrompts(count, tunisClock(now).day)
