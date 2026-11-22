// Taste match: how close two people's taste is, from the titles they both rated (five stars each).
// Pure rules (tests/taste.unit.test.mts); lib/social/taste.ts reads the ratings each side may see.
//
// The score: every title rated by both counts by how close the stars are (the same stars: full
// agreement; four stars apart: none), the average turned into a percentage. With only a few titles
// in common it leans towards the middle, so two lucky matches don't read as "film twins".

export type Rated = { key: string, media_type: 'movie' | 'tv', id: string, stars: number, at: number }

/** Fewer titles in common than this: no score yet, only what to rate next. */
export const MIN_COMMON = 3
/** How strongly a small overlap leans to 50%: like this many neutral titles added. */
const PRIOR = 2
const LOVED = 4

export type Verdict = 'twins' | 'great' | 'common' | 'opposites'

export const verdictFor = (score: number): Verdict => (score >= 85 ? 'twins' : score >= 70 ? 'great' : score >= 50 ? 'common' : 'opposites')

export type Pair = { key: string, media_type: 'movie' | 'tv', id: string, mine: number, theirs: number }

export type TasteMatch = {
  /** 0 to 100, or null below MIN_COMMON titles in common. */
  score: number | null
  verdict: Verdict | null
  common: number
  /** Both gave it four stars or more, the best loved first. */
  bothLoved: Pair[]
  /** Two stars apart or more, the widest gap first. */
  disagree: Pair[]
  /** They gave it four stars or more, you haven't rated it: the newest first. */
  theyLoved: Rated[]
  /** Your four or five stars they haven't rated. */
  youLoved: Rated[]
}

/** How close two ratings are: 1 for the same stars, 0 for four stars apart. */
export const agreement = (a: number, b: number) => 1 - Math.min(4, Math.abs(a - b)) / 4

export function scoreOf(pairs: readonly Pick<Pair, 'mine' | 'theirs'>[]): number | null {
  if (pairs.length < MIN_COMMON) return null
  const total = pairs.reduce((sum, pair) => sum + agreement(pair.mine, pair.theirs), 0)
  // Agreement runs higher than chance would suggest (most ratings sit at 3 to 5 stars), so the
  // middle of the scale is a 0.6 agreement, not 0.5: stretched so that it reads as 50%.
  const raw = (total + PRIOR * 0.6) / (pairs.length + PRIOR)
  const stretched = raw <= 0.6 ? (raw / 0.6) * 50 : 50 + ((raw - 0.6) / 0.4) * 50
  return Math.max(0, Math.min(100, Math.round(stretched)))
}

export function tasteMatch(mine: readonly Rated[], theirs: readonly Rated[], limit = 12): TasteMatch {
  const myStars = new Map(mine.map((row) => [row.key, row]))
  const theirStars = new Map(theirs.map((row) => [row.key, row]))
  const pairs: Pair[] = []
  for (const row of theirs) {
    const own = myStars.get(row.key)
    if (own) pairs.push({ key: row.key, media_type: row.media_type, id: row.id, mine: own.stars, theirs: row.stars })
  }
  const score = scoreOf(pairs)
  const newest = (a: Rated, b: Rated) => b.stars - a.stars || b.at - a.at
  return {
    score,
    verdict: score === null ? null : verdictFor(score),
    common: pairs.length,
    bothLoved: pairs
      .filter((pair) => pair.mine >= LOVED && pair.theirs >= LOVED)
      .sort((a, b) => b.mine + b.theirs - (a.mine + a.theirs))
      .slice(0, limit),
    disagree: pairs
      .filter((pair) => Math.abs(pair.mine - pair.theirs) >= 2)
      .sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs))
      .slice(0, Math.ceil(limit / 2)),
    theyLoved: theirs.filter((row) => row.stars >= LOVED && !myStars.has(row.key)).sort(newest).slice(0, limit),
    youLoved: mine.filter((row) => row.stars >= LOVED && !theirStars.has(row.key)).sort(newest).slice(0, limit),
  }
}
