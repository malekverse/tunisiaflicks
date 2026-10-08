"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { useScrollChrome } from '@/src/hooks/use-scroll-chrome'
import { useT } from '@/src/components/I18nProvider'
import { TABS, isActive } from './nav'
import AccountAvatar from './AccountAvatar'
import MenuSheet from './MenuSheet'
import { useShellAccount } from './use-shell-account'
import type { SeasonalNav } from '@/src/lib/seasons'

export type TabBarProps = {
    /** A Kids profile is in use (from the server, so grown-up items never flash). */
    kids?: boolean
    /** The seasonal nav item, if any, for the menu sheet's places (getSeasonalNav in src/lib/seasons.ts). */
    seasonal?: SeasonalNav | null
}

/**
 * Phones and tablets: a floating glass tab bar in the thumb zone. It shrinks a little while the
 * viewer scrolls down (the labels fade) and comes back to full size on the way up. The last tab,
 * "You", opens the menu sheet with everything else.
 */
export default function TabBar(props: TabBarProps = {}) {
    // kids and seasonal are wired from the root layout; the social track puts them to use.
    void props
    const t = useT()
    const pathname = usePathname()
    const { retracted } = useScrollChrome(140)
    const account = useShellAccount()
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => setMenuOpen(false), [pathname])

    // "Who's watching?" is a gate, not a place: no navigation there.
    if (pathname.startsWith('/profiles')) return null

    const tab = 'relative flex h-[52px] flex-col items-center justify-center gap-[3px] rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-red-500 pressable'
    const label = cn('relative text-[10.5px] font-medium leading-none transition-opacity duration-200', retracted && 'opacity-0')

    return (
        <>
            <nav
                aria-label={t('nav.tabs')}
                className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] lg:hidden"
            >
                <div
                    className={cn(
                        'glass-strong pointer-events-auto mx-auto grid max-w-[440px] origin-bottom grid-cols-5 rounded-[26px] p-1.5 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9)] transition-transform duration-300 ease-out',
                        retracted && 'translate-y-1.5 scale-[0.92]',
                    )}
                >
                    {TABS.map((item) => {
                        const active = isActive(pathname, item.href)
                        const Icon = item.icon
                        return (
                            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn(tab, active ? 'text-white' : 'text-white/55')}>
                                {active && <m.span layoutId="tab-pill" transition={spring.ui} aria-hidden className="absolute inset-0 rounded-[20px] bg-white/[0.12]" />}
                                <Icon aria-hidden className="relative h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                                <span className={label}>{t(item.label)}</span>
                            </Link>
                        )
                    })}
                    <button
                        type="button"
                        onClick={() => setMenuOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={menuOpen}
                        className={cn(tab, menuOpen ? 'text-white' : 'text-white/55')}
                    >
                        <AccountAvatar
                            active={account.active}
                            image={account.avatarSrc}
                            isOwner={account.isOwner}
                            name={account.name}
                            className="relative h-[24px] w-[24px] text-[11px] ring-1 ring-white/20"
                        />
                        <span className={label}>{t('nav.you')}</span>
                    </button>
                </div>
            </nav>
            <MenuSheet open={menuOpen} onOpenChange={setMenuOpen} account={account} />
        </>
    )
}
