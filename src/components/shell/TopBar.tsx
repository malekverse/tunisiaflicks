"use client"
import Link from 'next/link'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { useScrollChrome } from '@/src/hooks/use-scroll-chrome'
import { useSearchPalette } from '@/src/store/search-palette'
import { useT } from '@/src/components/I18nProvider'
import InboxBell from '@/src/components/inbox/InboxBell'
import LanguageSwitch from './LanguageSwitch'
import AccountMenu from './AccountMenu'

export type TopBarProps = {
  /** A Kids profile is in use (from the server). */
  kids?: boolean
  /** Whether the search pill also offers Ask (AI search): never for Kids or in TV mode. */
  ask?: boolean
}

/**
 * The top bar floats over the page: a soft dark fade while the hero is showing, frosted glass once
 * the page scrolls. On phones it tucks away while scrolling down and returns on the way back up.
 */
export default function TopBar({ ask = false }: TopBarProps = {}) {
  const t = useT()
  const { scrolled, retracted } = useScrollChrome()
  const openSearch = useSearchPalette((state) => state.setOpen)

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-transform duration-300 ease-out',
        retracted && 'max-lg:-translate-y-full',
      )}
    >
      <div aria-hidden className={cn('glass-strong absolute inset-0 border-x-0 border-t-0 transition-opacity duration-300', scrolled ? 'opacity-100' : 'opacity-0')} />
      <div aria-hidden className={cn('absolute inset-x-0 top-0 h-[150%] bg-gradient-to-b from-black/75 via-black/30 to-transparent transition-opacity duration-300', scrolled && 'opacity-0')} />

      <div className="page-x relative flex items-center gap-3 pt-[env(safe-area-inset-top)]" style={{ height: 'calc(var(--topbar) + env(safe-area-inset-top, 0px))' }}>
        {/* Phones and tablets: the wordmark (the desktop rail carries the logo). */}
        <Link href="/" aria-label={t('nav.homeAria')} className="flex items-center gap-2 lg:hidden">
          <Image src="/A.svg" alt="" width={28} height={24} priority className="h-6 w-auto" />
          <Image src="/TunisiaFlicks.svg" alt="TunisiaFlicks" width={120} height={16} priority className="h-[14px] w-auto" />
        </Link>

        <button
          type="button"
          onClick={() => openSearch(true)}
          className="pressable group hidden h-10 w-full max-w-[420px] items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] pe-2 ps-4 text-start text-sm text-white/55 outline-none transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.09] hover:text-white/80 focus-visible:ring-2 focus-visible:ring-red-500 lg:flex"
        >
          <Search aria-hidden className="h-[18px] w-[18px]" />
          <span className="flex-1 truncate">{t(ask ? 'ai.searchOrAsk' : 'search.open')}</span>
          <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 font-sans text-[11px] text-white/50" aria-label={t('search.shortcutHint')}>/</kbd>
        </button>

        <div className="flex-1" />

        <LanguageSwitch compact className="hidden lg:flex" />
        <InboxBell />
        <div className="hidden lg:block">
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
