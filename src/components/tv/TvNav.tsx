"use client"
// The TV bar: one row of places along the top, inside the safe area. The page you're on carries the
// red signal bar; the focused item is a white pill (tv.css). It steps aside while you browse the
// page and comes back as soon as focus returns to it (Up from the top of the page).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Clapperboard, Drama, House, Library, LogIn, RadioTower, Search, Settings, Tv } from 'lucide-react'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import ProfileAvatar from '@/src/components/profiles/ProfileAvatar'
import { useT } from '@/src/components/I18nProvider'
import { useProfiles } from '@/src/hooks/use-profiles'
import { activeHref, visibleItems, type NavItem } from '@/src/components/shell/nav'
import { cn } from '@/src/lib/utils'

const TunisiaIcon = ({ className }: { className?: string }) => <TunisiaMark className={className} />

/** TV mode's places (the NavItem shape of src/components/shell/nav.tsx, Kids rules included). */
export const TV_NAV: NavItem[] = [
  { href: '/', label: 'nav.home', icon: House },
  { href: '/search', label: 'nav.search', icon: Search },
  { href: '/discover', label: 'tvMode.nav.movies', icon: Clapperboard },
  { href: '/tv', label: 'nav.tvShows', icon: Tv },
  { href: '/tunisian', label: 'nav.tunisian', icon: TunisiaIcon, kidsHref: '/tunisian/cinema' },
  { href: '/tunisian/tv', label: 'tvMode.nav.tunisianTv', icon: RadioTower, grownUp: true },
  { href: '/dramas', label: 'tvMode.nav.dramas', icon: Drama, grownUp: true },
  { href: '/saved', label: 'tvMode.nav.library', icon: Library, match: ['/favorites', '/history', '/lists'] },
  { href: '/profile', label: 'nav.settings', icon: Settings },
]

/** Where an item goes (Settings opens on its TV mode switch). */
const linkOf = (item: NavItem) => (item.href === '/profile' ? '/profile#display' : item.href)

export default function TvNav({ onSignIn }: { onSignIn: () => void }) {
  const t = useT()
  const pathname = usePathname()
  const { status } = useSession()
  const { active } = useProfiles()
  const items = visibleItems(TV_NAV, active?.kids ?? false)
  const current = activeHref(pathname, items)
  const [away, setAway] = useState(false)

  // Out of the way once the page has scrolled and focus is down in it; back when focus comes up.
  useEffect(() => {
    const update = () => {
      const inBar = !!document.activeElement?.closest('[data-tv-nav]')
      setAway(window.scrollY > 120 && !inBar)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    document.addEventListener('focusin', update)
    return () => {
      window.removeEventListener('scroll', update)
      document.removeEventListener('focusin', update)
    }
  }, [])

  return (
    <nav
      data-tv-nav
      aria-label={t('tvMode.nav.aria')}
      className={cn(
        'fixed inset-x-[var(--tv-safe-x)] top-[var(--tv-safe-y)] z-50 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-opacity',
        away && 'pointer-events-none -translate-y-[calc(100%+var(--tv-safe-y))] opacity-0',
      )}
    >
      <div className="glass-strong flex h-[var(--tv-nav-h)] items-center gap-3 rounded-full px-3 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.9)]">
        <span className="hidden shrink-0 items-center gap-2 ps-3 xl:flex">
          <Image src="/A.svg" alt="" width={28} height={24} className="h-[1.4em] w-auto" />
          <Image src="/TunisiaFlicks.svg" alt="TunisiaFlicks" width={120} height={16} className="h-[0.85em] w-auto" />
        </span>

        <ul className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 xl:justify-center">
          {items.map((item) => {
            const Icon = item.icon
            const here = item.href === current
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={linkOf(item)}
                  aria-current={here ? 'page' : undefined}
                  className={cn(
                    'relative flex h-[calc(var(--tv-nav-h)-16px)] items-center gap-2 whitespace-nowrap rounded-full px-[0.95em] text-[15px] font-medium outline-none transition-colors duration-150',
                    here ? 'text-white' : 'text-white/70',
                  )}
                >
                  <Icon className="h-[1.15em] w-[1.15em] shrink-0" strokeWidth={2} />
                  <span>{t(item.label)}</span>
                  {here && <span aria-hidden className="absolute inset-x-[1.1em] -bottom-[3px] h-[3px] rounded-full bg-red-500" />}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="flex shrink-0 items-center pe-1">
          {status === 'unauthenticated' ? (
            <button
              type="button"
              onClick={onSignIn}
              className="flex h-[calc(var(--tv-nav-h)-16px)] items-center gap-2 rounded-full bg-white/[0.08] px-[1em] text-[15px] font-semibold text-white outline-none"
            >
              <LogIn aria-hidden className="h-[1.1em] w-[1.1em] rtl:rotate-180" />
              {t('tvMode.nav.signIn')}
            </button>
          ) : active ? (
            <span className="flex items-center gap-2.5 pe-2 text-[15px] text-white/70">
              <ProfileAvatar profile={active} size="sm" />
              <bdi className="hidden max-w-[10em] truncate lg:inline">{active.name}</bdi>
            </span>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
