// Every destination of the app, in one place: the desktop rail, the mobile tab bar and the mobile
// menu sheet all read from here, so they can never disagree. Tracks add their own item to the
// group the IA gives them; Kids filtering and "which item is lit" are decided here too.
import {
  Bookmark, CalendarClock, CalendarHeart, Clapperboard, Compass, Dices, Flag, Heart, HeartHandshake, History, House,
  Library, ListVideo, MoonStar, Search, Sparkles, Trophy, Tv, type LucideIcon,
} from 'lucide-react'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import type { TKey } from '@/src/lib/i18n'
import type { SeasonalIconKey, SeasonalNav } from '@/src/lib/seasons'

type Icon = LucideIcon | ((props: { className?: string, strokeWidth?: number }) => JSX.Element)

// The crescent and star stands for "Tunisian" (an inline SVG: no icon pack to load).
const TunisiaIcon = ({ className }: { className?: string }) => <TunisiaMark className={className} />

export type NavItem = {
  href: string
  label: TKey
  icon: Icon
  /** A route handler (fresh random pick each time): use a plain <a>, not a prefetched <Link>. */
  plain?: boolean
  /** More paths that light this item up (Library is lit on /favorites, /history and /lists too). */
  match?: string[]
  /** Hidden on Kids profiles. */
  grownUp?: boolean
  /** Where a Kids profile goes instead (Tunisian: the cinema, which has kid-safe titles). */
  kidsHref?: string
  /** What a Kids profile gets in this slot instead (Movie night becomes Swipe). */
  kidsAlt?: Omit<NavItem, 'kidsAlt'>
}

export const BROWSE: NavItem[] = [
  { href: '/', label: 'nav.home', icon: House },
  { href: '/tv', label: 'nav.tvShows', icon: Tv },
  { href: '/discover', label: 'nav.discover', icon: Compass },
  { href: '/clips', label: 'nav.clips', icon: Clapperboard },
  { href: '/upcoming', label: 'nav.comingSoon', icon: CalendarClock },
  { href: '/top-rated', label: 'nav.topRated', icon: Trophy },
  { href: '/surprise', label: 'nav.surprise', icon: Dices, plain: true },
]

/** The world's cinema and TV: Tunisian, then each hub, then the seasonal slot (see Rail). */
export const WORLD: NavItem[] = [
  { href: '/tunisian', label: 'nav.tunisian', icon: TunisiaIcon, kidsHref: '/tunisian/cinema' },
]

/** Saved first: the Library landing page is the first tab (LibraryTabs and the menu sheet follow this order). */
export const LIBRARY: NavItem[] = [
  { href: '/saved', label: 'nav.bookmarked', icon: Bookmark },
  { href: '/favorites', label: 'nav.favorites', icon: Heart },
  { href: '/history', label: 'nav.recent', icon: History },
  { href: '/lists', label: 'nav.myLists', icon: ListVideo },
]

/**
 * What's yours. Final shape: Friends, Movie night (Kids: Swipe), Library. Until those ship, Swipe
 * keeps the Movie night slot and My Year stays after Library.
 */
export const YOURS: NavItem[] = [
  { href: '/swipe', label: 'swipe.title', icon: HeartHandshake },
  { href: '/saved', label: 'nav.library', icon: Library, match: ['/favorites', '/history', '/lists'] },
  { href: '/wrapped', label: 'nav.myYear', icon: Sparkles },
]

/** The mobile tab bar: the four places people go most, plus "You" (the menu sheet). */
export const TABS: NavItem[] = [
  { href: '/', label: 'nav.home', icon: House },
  { href: '/discover', label: 'nav.discover', icon: Compass },
  { href: '/clips', label: 'nav.clips', icon: Clapperboard },
  { href: '/search', label: 'nav.search', icon: Search },
]

/** The seasonal slot's icons (the server hands over a key: components can't cross to the client). */
export const SEASONAL_ICONS: Record<SeasonalIconKey, LucideIcon> = {
  moon: MoonStar,
  flag: Flag,
  year: CalendarHeart,
}

/** The seasonal slot as a nav item. */
export const seasonalItem = (seasonal: SeasonalNav): NavItem => ({ href: seasonal.href, label: seasonal.label, icon: SEASONAL_ICONS[seasonal.icon] })

/** Is `href` the current section? Home only matches itself. */
export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

/** Is the item lit: its own href, or one of its `match` paths. */
export const isItemActive = (pathname: string, item: NavItem) =>
  !item.plain && (isActive(pathname, item.href) || (item.match ?? []).some((path) => isActive(pathname, path)))

/** The one item to light among `items`: when several match, the longest path wins. */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: { href: string, length: number } | null = null
  for (const item of items) {
    if (item.plain) continue
    for (const path of [item.href, ...(item.match ?? [])]) {
      if (isActive(pathname, path) && (!best || path.length > best.length)) best = { href: item.href, length: path.length }
    }
  }
  return best?.href ?? null
}

/** The items a profile sees: for Kids, alternatives replace items, grown-up items go, and Kids hrefs apply. */
export function visibleItems(items: NavItem[], kids: boolean): NavItem[] {
  if (!kids) return items
  return items.flatMap((item) => {
    if (item.kidsAlt) return [item.kidsAlt as NavItem]
    if (item.grownUp) return []
    return [item.kidsHref ? { ...item, href: item.kidsHref } : item]
  })
}
