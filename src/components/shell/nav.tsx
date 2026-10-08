// Every destination of the app, in one place: the desktop rail, the mobile tab bar and the mobile
// menu sheet all read from here, so they can never disagree.
import {
  Bookmark, CalendarClock, Clapperboard, Compass, Dices, Heart, HeartHandshake, History, House,
  ListVideo, Search, Sparkles, Trophy, Tv, type LucideIcon,
} from 'lucide-react'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import type { TKey } from '@/src/lib/i18n'

type Icon = LucideIcon | ((props: { className?: string, strokeWidth?: number }) => JSX.Element)

// The crescent and star stands for "Tunisian" (an inline SVG: no icon pack to load).
const TunisiaIcon = ({ className }: { className?: string }) => <TunisiaMark className={className} />

export type NavItem = {
  href: string
  label: TKey
  icon: Icon
  /** A route handler (fresh random pick each time): use a plain <a>, not a prefetched <Link>. */
  plain?: boolean
}

export const BROWSE: NavItem[] = [
  { href: '/', label: 'nav.home', icon: House },
  { href: '/tv', label: 'nav.tvShows', icon: Tv },
  { href: '/discover', label: 'nav.discover', icon: Compass },
  { href: '/clips', label: 'nav.clips', icon: Clapperboard },
  { href: '/tunisian', label: 'nav.tunisian', icon: TunisiaIcon },
  { href: '/upcoming', label: 'nav.comingSoon', icon: CalendarClock },
  { href: '/top-rated', label: 'nav.topRated', icon: Trophy },
]

export const LIBRARY: NavItem[] = [
  { href: '/history', label: 'nav.recent', icon: History },
  { href: '/favorites', label: 'nav.favorites', icon: Heart },
  { href: '/saved', label: 'nav.bookmarked', icon: Bookmark },
  { href: '/lists', label: 'nav.myLists', icon: ListVideo },
]

export const EXTRAS: NavItem[] = [
  { href: '/swipe', label: 'swipe.title', icon: HeartHandshake },
  { href: '/wrapped', label: 'nav.myYear', icon: Sparkles },
  { href: '/surprise', label: 'nav.surprise', icon: Dices, plain: true },
]

/** The mobile tab bar: the four places people go most, plus "You" (the menu sheet). */
export const TABS: NavItem[] = [
  { href: '/', label: 'nav.home', icon: House },
  { href: '/discover', label: 'nav.discover', icon: Compass },
  { href: '/clips', label: 'nav.clips', icon: Clapperboard },
  { href: '/search', label: 'nav.search', icon: Search },
]

/** Is `href` the current section? Home only matches itself. */
export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
