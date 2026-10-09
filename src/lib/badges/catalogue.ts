// The badge catalogue: what each badge measures, its four thresholds (bronze, silver, gold,
// platinum), whether a Kids profile can earn it and whether anyone else may ever see it. Pure data
// and arithmetic, safe on the client and in unit tests.
//
// Levels: 0 locked, 1 bronze, 2 silver, 3 gold, 4 platinum. A single-level badge (Opening night,
// Supporter) is gold the moment it is earned. Levels only ever go up (they are written with $max).

export const BADGE_IDS = [
  'openingNight', 'marathon', 'nightOwl', 'earlyBird', 'ramadan', 'tunisian',
  'genres', 'world', 'decades', 'finisher', 'streakWeeks', 'supporter',
] as const

export type BadgeId = (typeof BADGE_IDS)[number]
export type Level = 0 | 1 | 2 | 3 | 4
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'

/** never: only the owner ever sees it; optIn: shown to others only when the owner says so (Supporter). */
export type Publicity = 'yes' | 'never' | 'optIn'

export type BadgeDef = {
  id: BadgeId
  /** Bronze, silver, gold, platinum: the value each level needs. Null for a single-level badge. */
  thresholds: readonly [number, number, number, number] | null
  /** Kids profiles can earn (and see) it. */
  kids: boolean
  public: Publicity
  /** Hidden from the shelf and 'Up next' until earned. */
  hiddenUntilEarned?: boolean
}

/** Bump when a threshold or a measure changes: every profile is recomputed on its next view. */
export const CATALOGUE_VERSION = 1

/** The level a single-level badge gets. */
export const SINGLE_LEVEL: Level = 3

export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold', 'platinum']

/** Each tier's metal, as 'r g b' (the rim gradient and the glyph). */
export const TIER_RGB: Record<Tier, string> = {
  bronze: '176 128 84',
  silver: '190 196 204',
  gold: '214 178 96',
  platinum: '216 226 236',
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'openingNight', thresholds: null, kids: true, public: 'yes' },
  { id: 'marathon', thresholds: [3, 5, 8, 12], kids: false, public: 'yes' },
  { id: 'nightOwl', thresholds: [3, 10, 25, 50], kids: false, public: 'never' },
  { id: 'earlyBird', thresholds: [3, 10, 25, 50], kids: false, public: 'never' },
  { id: 'ramadan', thresholds: [7, 15, 22, 29], kids: false, public: 'never' },
  { id: 'tunisian', thresholds: [1, 5, 15, 30], kids: true, public: 'yes' },
  { id: 'genres', thresholds: [5, 10, 14, 18], kids: true, public: 'yes' },
  { id: 'world', thresholds: [3, 6, 10, 15], kids: true, public: 'yes' },
  { id: 'decades', thresholds: [3, 5, 7, 9], kids: true, public: 'yes' },
  { id: 'finisher', thresholds: [1, 5, 15, 30], kids: true, public: 'yes' },
  { id: 'streakWeeks', thresholds: [2, 4, 12, 26], kids: false, public: 'yes' },
  { id: 'supporter', thresholds: null, kids: false, public: 'optIn', hiddenUntilEarned: true },
]

const BY_ID = new Map<string, BadgeDef>(BADGES.map((badge) => [badge.id, badge]))

export const isBadgeId = (value: unknown): value is BadgeId => typeof value === 'string' && BY_ID.has(value)
export const badgeDef = (id: BadgeId): BadgeDef => BY_ID.get(id)!

/** The badges a Kids profile can earn and see (discovery badges, never money talk). */
export const KIDS_BADGES: ReadonlySet<BadgeId> = new Set(BADGES.filter((badge) => badge.kids).map((badge) => badge.id))

/** Never on a page anyone else can open, whatever the privacy settings say. */
export const PRIVATE_BADGES: ReadonlySet<BadgeId> = new Set(BADGES.filter((badge) => badge.public === 'never').map((badge) => badge.id))

/** The badges a profile can hold: Kids get the discovery ones only. */
export const badgesFor = (kids: boolean): BadgeDef[] => BADGES.filter((badge) => !kids || badge.kids)

/** The highest level `value` reaches (0 when none). */
export function levelFor(value: number, badge: Pick<BadgeDef, 'thresholds'>): Level {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!badge.thresholds) return value >= 1 ? SINGLE_LEVEL : 0
  let level = 0
  badge.thresholds.forEach((threshold, index) => {
    if (value >= threshold) level = index + 1
  })
  return level as Level
}

export const tierOf = (level: Level): Tier | null => (level >= 1 ? TIERS[level - 1] : null)

export const isMaxLevel = (badge: Pick<BadgeDef, 'thresholds'>, level: number) => (badge.thresholds ? level >= 4 : level >= SINGLE_LEVEL)

/**
 * What the next level asks for: the target value and the level it unlocks, or null when the badge
 * is already at its top. Progress shown is `min(value, target) / target`.
 */
export function nextStep(value: number, badge: Pick<BadgeDef, 'thresholds'>, level: number): { target: number; level: Level } | null {
  if (isMaxLevel(badge, level)) return null
  if (!badge.thresholds) return { target: 1, level: SINGLE_LEVEL }
  const next = Math.min(4, Math.max(level, levelFor(value, badge)) + 1) as Level
  return { target: badge.thresholds[next - 1], level: next }
}

/** The art's file name: `/badges/art/{id}-{level}.svg` (0 = locked). */
export const badgeArtPath = (id: BadgeId, level: number) => `/badges/art/${id}-${Math.max(0, Math.min(4, Math.floor(level)))}.svg`
