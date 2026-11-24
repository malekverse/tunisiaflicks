// The whole programme (/about, components/landing/Programme): everything TunisiaFlicks does, in
// groups, each thing with its page. The ways to pick a film come from the play tools
// (components/play/tools), so a new one shows up here too; everything else is listed here.
// Names and lines are programme.<id> and programme.<id>.text (lib/i18n/features/programme). A thing
// without a page of its own says where it lives instead (`at`). Pure: the unit tests import it.

export type ProgrammeGroupId = 'find' | 'world' | 'pick' | 'together' | 'yours' | 'family' | 'screens' | 'plus' | 'account'

/** Where a thing without a page of its own is. */
export type ProgrammeAt = 'title' | 'player' | 'inbox' | 'home'

export type ProgrammeItem = {
  id: string
  href?: string
  /** A route handler (a fresh pick each time): a plain <a>, not a prefetched <Link>. */
  plain?: boolean
  at?: ProgrammeAt
  /** Left out on Kids profiles. */
  grownUp?: boolean
  /** "New" until then (YYYY-MM-DD). */
  newUntil?: string
}

export type ProgrammeGroup = {
  id: ProgrammeGroupId
  /** Its colour ('r g b'): the cards' icons, and the room's light while it's on screen. */
  light: string
  /** Left out on Kids profiles, whole. */
  grownUp?: boolean
  /** The play tools go here (see Programme). */
  play?: boolean
  items: ProgrammeItem[]
}

const RECENT = '2027-02-15'

export const PROGRAMME: ProgrammeGroup[] = [
  {
    id: 'find',
    light: '255 36 20',
    items: [
      { id: 'search', href: '/search' },
      { id: 'discover', href: '/discover' },
      { id: 'clips', href: '/clips' },
      { id: 'upcoming', href: '/upcoming' },
      { id: 'topRated', href: '/top-rated' },
      { id: 'franchise', at: 'title', newUntil: RECENT },
      { id: 'offers', at: 'title', newUntil: RECENT },
      { id: 'extras', at: 'title' },
      { id: 'seen', at: 'title' },
    ],
  },
  {
    id: 'world',
    light: '30 110 255',
    items: [
      { id: 'tunisian', href: '/tunisian', grownUp: true },
      { id: 'tunisianTv', href: '/tunisian/tv', grownUp: true },
      { id: 'tunisianCinema', href: '/tunisian/cinema' },
      { id: 'ramadan', href: '/ramadan' },
      { id: 'filmed', href: '/filmed-in-tunisia', newUntil: RECENT },
      { id: 'dramas', href: '/dramas', grownUp: true },
      { id: 'anime', href: '/anime' },
      { id: 'arabMap', href: '/arab-cinema' },
      { id: 'moments', at: 'home' },
    ],
  },
  {
    id: 'pick',
    light: '168 85 247',
    play: true,
    items: [
      { id: 'surprise', href: '/surprise', plain: true },
    ],
  },
  {
    id: 'together',
    light: '40 196 184',
    grownUp: true,
    items: [
      { id: 'friends', href: '/friends' },
      { id: 'taste', href: '/friends' },
      { id: 'sharedLists', href: '/lists' },
      { id: 'movieNight', href: '/movie-night' },
      { id: 'party', href: '/desktop', newUntil: '2027-01-31' },
    ],
  },
  {
    id: 'yours',
    light: '245 190 80',
    items: [
      { id: 'library', href: '/saved' },
      { id: 'continue', at: 'home' },
      { id: 'shows', href: '/shows' },
      { id: 'alerts', href: '/notifications' },
      { id: 'calendar', href: '/profile#following' },
      { id: 'digest', at: 'inbox', grownUp: true },
      { id: 'challenges', href: '/challenges', grownUp: true },
      { id: 'badges', href: '/me' },
      { id: 'wrapped', href: '/wrapped' },
    ],
  },
  {
    id: 'family',
    light: '34 197 94',
    items: [
      { id: 'profiles', href: '/profiles' },
      { id: 'kids', href: '/profiles' },
      { id: 'screenTime', href: '/profiles', grownUp: true, newUntil: RECENT },
      { id: 'halal', href: '/profile#halal' },
      { id: 'sleep', at: 'player', newUntil: RECENT },
    ],
  },
  {
    id: 'screens',
    light: '104 124 255',
    items: [
      { id: 'phone', href: '/app' },
      { id: 'androidTv', href: '/app' },
      { id: 'tvMode', href: '/activate' },
      { id: 'sendToTv', at: 'title', grownUp: true, newUntil: RECENT },
      { id: 'desktop', href: '/desktop' },
      { id: 'chromecast', href: '/desktop', newUntil: RECENT },
    ],
  },
  {
    id: 'plus',
    light: '236 72 153',
    // No money talk on Kids profiles.
    grownUp: true,
    items: [
      { id: 'plus', href: '/plus' },
      { id: 'familyPlus', href: '/plus' },
      { id: 'gift', href: '/plus' },
      { id: 'invite', href: '/plus' },
      { id: 'support', href: '/support' },
    ],
  },
  {
    id: 'account',
    light: '200 162 122',
    items: [
      { id: 'languages', href: '/profile#display' },
      { id: 'data', href: '/profile#data', grownUp: true },
      { id: 'security', href: '/profile#security', grownUp: true },
    ],
  },
]

/** The groups a profile sees: Kids profiles go without the grown-up groups and things. */
export function programmeFor(kids: boolean): ProgrammeGroup[] {
  if (!kids) return PROGRAMME
  return PROGRAMME
    .filter((group) => !group.grownUp)
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.grownUp) }))
}

export const isNewItem = (item: Pick<ProgrammeItem, 'newUntil'>, now = Date.now()) =>
  !!item.newUntil && now < Date.parse(`${item.newUntil}T00:00:00Z`)

/** Lower case, without accents or Arabic vowel marks, tatweel and the hamza/alef variants folded. */
export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLocaleLowerCase()
}

/** Does `text` hold every word of what was typed (anywhere, in any order)? An empty query holds. */
export function programmeMatches(query: string, text: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = foldText(text)
  return words.every((word) => haystack.includes(word))
}
