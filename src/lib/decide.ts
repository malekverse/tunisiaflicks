// "Decide together" (/decide): friends in the same room, one phone, everyone throwing in a pick.
// These are the pure rules behind each way of deciding (the wheel's odds, the vote's count and its
// tie-break, the knockout's turns, the duels' bracket, who gets to choose), with no React, no
// storage and no server: everything happens in the browser, so the tool costs nothing to run.
// Randomness comes in as a function (crypto in the browser, a fixed sequence in the unit tests:
// tests/decide.unit.test.mts).

export const PEOPLE_MAX = 10
export const PICKS_MAX = 16
export const NAME_MAX = 20
/** Films for tonight: one, or a double / triple feature. */
export const COUNT_MAX = 3

export type Person = { id: string, name: string }
export type Pick = {
  /** "movie:550" */
  key: string
  media_type: 'movie' | 'tv'
  id: string
  title: string
  poster_path: string | null
  backdrop_path: string | null
  year: string
  /** Who threw it in (a person's id), or null for "anyone". */
  by: string | null
}
export type Method = 'wheel' | 'vote' | 'knockout' | 'duel' | 'chooser'
export const METHODS: Method[] = ['wheel', 'vote', 'knockout', 'duel', 'chooser']

/** A uniform integer in [0, max). */
export type RandomInt = (max: number) => number

/** Unbiased, from the browser's crypto (Math.random when there's none). */
export const cryptoInt: RandomInt = (max) => {
  if (max <= 1) return 0
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (!cryptoApi?.getRandomValues) return Math.floor(Math.random() * max)
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  do cryptoApi.getRandomValues(buffer)
  while (buffer[0] >= limit)
  return buffer[0] % max
}

/** A random number in [0, 1) with 2^32 steps. */
const unit = (randomInt: RandomInt) => randomInt(0x1_0000_0000) / 0x1_0000_0000

export function shuffle<T>(items: readonly T[], randomInt: RandomInt = cryptoInt): T[] {
  const copy = items.slice()
  for (let index = copy.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

/** Clean display name: one line, no extra spaces, at most NAME_MAX characters. */
export function cleanName(value: string): string {
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()).slice(0, NAME_MAX).join('')
}

/** Is this name already taken (case and accents aside)? */
export function sameName(a: string, b: string): boolean {
  const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  return fold(cleanName(a)) === fold(cleanName(b))
}

// ---------------------------------------------------------------------------------------------
// The wheel

/**
 * Each pick's share of the wheel, summing to 1. `fair`: every person's picks share the same slice
 * of luck, so whoever throws in five films doesn't get five times the chances (the picks nobody
 * claimed count as one more person). Otherwise every film weighs the same.
 */
export function wheelWeights(picks: readonly Pick[], fair: boolean): number[] {
  if (!picks.length) return []
  if (!fair) return picks.map(() => 1 / picks.length)
  const groups = new Map<string, number>()
  for (const pick of picks) groups.set(pick.by ?? '', (groups.get(pick.by ?? '') ?? 0) + 1)
  return picks.map((pick) => 1 / groups.size / groups.get(pick.by ?? '')!)
}

/** Are the fair weights any different from equal ones (somebody threw in more than the others)? */
export function fairnessMatters(picks: readonly Pick[]): boolean {
  const weights = wheelWeights(picks, true)
  return weights.some((weight) => Math.abs(weight - weights[0]) > 1e-9)
}

/** The index the wheel lands on, for weights summing to 1. */
export function spinIndex(weights: readonly number[], randomInt: RandomInt = cryptoInt): number {
  const target = unit(randomInt)
  let total = 0
  for (let index = 0; index < weights.length; index++) {
    total += weights[index]
    if (target < total) return index
  }
  return Math.max(0, weights.length - 1)
}

/**
 * Where the wheel stops: the rotation (degrees, clockwise, always forward) that brings a random
 * point inside slice `index` under the pointer at the top, after a few full turns.
 */
export function landingRotation(weights: readonly number[], index: number, current: number, randomInt: RandomInt = cryptoInt, turns = 6): number {
  const start = weights.slice(0, index).reduce((sum, weight) => sum + weight, 0) * 360
  const size = weights[index] * 360
  // Not too close to an edge, so nobody argues about which slice the pointer is on.
  const inside = start + size * (0.15 + 0.7 * unit(randomInt))
  // The slice at angle a sits under the pointer when the wheel is turned by 360 - a.
  const wanted = (360 - inside) % 360
  const base = current - (((current % 360) + 360) % 360)
  return base + turns * 360 + wanted
}

// ---------------------------------------------------------------------------------------------
// The vote

/** One person's secret ballot: every film they'd happily watch, and at most one favourite. */
export type Ballot = { yes: string[], star: string | null }

export type Tally = { key: string, points: number, yes: number, stars: number }

/** A yes is a point, a favourite one more (a favourite counts as a yes too). */
export function tallyBallots(keys: readonly string[], ballots: readonly Ballot[]): Tally[] {
  const rows = new Map(keys.map((key) => [key, { key, points: 0, yes: 0, stars: 0 }]))
  for (const ballot of ballots) {
    const yes = new Set(ballot.yes)
    if (ballot.star) yes.add(ballot.star)
    for (const key of yes) {
      const row = rows.get(key)
      if (!row) continue
      row.yes++
      row.points++
    }
    const starred = ballot.star ? rows.get(ballot.star) : null
    if (starred) {
      starred.stars++
      starred.points++
    }
  }
  return sortTally([...rows.values()], keys)
}

/** A show of hands: so many hands per film. */
export function tallyHands(keys: readonly string[], hands: Readonly<Record<string, number>>): Tally[] {
  return sortTally(keys.map((key) => {
    const count = Math.max(0, Math.floor(hands[key] ?? 0))
    return { key, points: count, yes: count, stars: 0 }
  }), keys)
}

function sortTally(rows: Tally[], keys: readonly string[]): Tally[] {
  const order = new Map(keys.map((key, index) => [key, index]))
  return rows.sort((a, b) => b.points - a.points || b.stars - a.stars || order.get(a.key)! - order.get(b.key)!)
}

/**
 * The vote's result for `count` films: the films clearly in, and when the last places are tied
 * (same points and favourites), the tied films that still need a tie-break for the `open` places
 * left. Nothing is decided by list order.
 */
export function voteResult(tally: readonly Tally[], count: number): { winners: string[], tied: string[], open: number } {
  const want = Math.max(1, Math.min(count, tally.length))
  if (tally.length <= want) return { winners: tally.map((row) => row.key), tied: [], open: 0 }
  const edge = tally[want - 1]
  const same = (row: Tally) => row.points === edge.points && row.stars === edge.stars
  const winners = tally.filter((row) => !same(row) && (row.points > edge.points || (row.points === edge.points && row.stars > edge.stars))).map((row) => row.key)
  const tied = tally.filter(same).map((row) => row.key)
  const open = want - winners.length
  return tied.length > open ? { winners, tied, open } : { winners: [...winners, ...tied], tied: [], open: 0 }
}

// ---------------------------------------------------------------------------------------------
// The knockout

/** Whose turn it is to knock a film out: people take turns in `order` (no people: the group). */
export function knockoutTurn(order: readonly string[], knockedOut: number): string | null {
  return order.length ? order[knockedOut % order.length] : null
}

// ---------------------------------------------------------------------------------------------
// The duels

/** A single-elimination bracket: this round's films in pairs, the winners go on to the next. */
export type Bracket = { round: number, contenders: string[], index: number, winners: string[] }

export function startBracket(keys: readonly string[], randomInt: RandomInt = cryptoInt): Bracket {
  return settle({ round: 1, contenders: shuffle(keys, randomInt), index: 0, winners: [] })
}

/** The duel to play now ([a, b]), or null when one film is left (the champion). */
export function currentDuel(bracket: Bracket): [string, string] | null {
  if (bracket.contenders.length <= 1) return null
  return [bracket.contenders[bracket.index], bracket.contenders[bracket.index + 1]]
}

export const champion = (bracket: Bracket): string | null => (bracket.contenders.length === 1 ? bracket.contenders[0] : null)

/** How many duels this round has, and which one is being played (1-based). */
export function duelProgress(bracket: Bracket): { duel: number, of: number } {
  return { duel: bracket.index / 2 + 1, of: Math.floor(bracket.contenders.length / 2) }
}

export function chooseDuel(bracket: Bracket, winner: string): Bracket {
  const duel = currentDuel(bracket)
  if (!duel || !duel.includes(winner)) return bracket
  return settle({ ...bracket, index: bracket.index + 2, winners: [...bracket.winners, winner] })
}

/** Moves on: a film without a rival goes through on its own; a finished round starts the next. */
function settle(bracket: Bracket): Bracket {
  let next = bracket
  for (;;) {
    const left = next.contenders.length - next.index
    if (next.contenders.length <= 1) return next
    if (left >= 2) return next
    const winners = left === 1 ? [...next.winners, next.contenders[next.index]] : next.winners
    // The film that got a free pass plays first next round, so it can't get two in a row.
    const contenders = left === 1 ? [winners[winners.length - 1], ...winners.slice(0, -1)] : winners
    next = { round: next.round + 1, contenders, index: 0, winners: [] }
  }
}

// ---------------------------------------------------------------------------------------------
// Who chooses

/**
 * Who gets to choose tonight. `fair`: whoever chose last time (by name, from this phone's history)
 * sits this one out, as long as someone else is there.
 */
export function drawChooser<P extends Person>(people: readonly P[], lastChooser: string | null, fair: boolean, randomInt: RandomInt = cryptoInt): P | null {
  if (!people.length) return null
  const pool = fair && lastChooser && people.length > 1 ? people.filter((person) => !sameName(person.name, lastChooser)) : people
  const from = pool.length ? pool : people
  return from[randomInt(from.length)]
}
