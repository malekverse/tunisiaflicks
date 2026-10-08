"use client"
import Link from 'next/link'
import { ChevronRight, LogOut, Settings, TvMinimal } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/src/components/ui/drawer'
import { Button } from '@/src/components/ui/button'
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar'
import KidsUnlockDialog from '@/src/components/profiles/KidsUnlockDialog'
import FriendsTile from '@/src/components/social/FriendsTile'
import NightTile from '@/src/components/movie-night/NightTile'
import { useT } from '@/src/components/I18nProvider'
import { useLikelyTv } from '@/src/hooks/use-tv-mode'
import { cn } from '@/src/lib/utils'
import type { SeasonalNav } from '@/src/lib/seasons'
import { BROWSE, LIBRARY, TABS, WORLD, YOURS, seasonalItem, visibleItems, type NavItem } from './nav'
import AccountAvatar from './AccountAvatar'
import LanguageSwitch from './LanguageSwitch'
import type { useShellAccount } from './use-shell-account'

/** YOURS entries that have their own tile in the Together pair (not repeated among the places). */
const TILE_HREFS = ['/friends', '/movie-night']

/**
 * Phones: the "You" sheet. Account and profiles on top, the Together tiles (friends, movie night),
 * then every place that isn't a tab, the library, the language and signing out.
 */
export default function MenuSheet({ open, onOpenChange, account, kids: kidsProp, seasonal }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    account: ReturnType<typeof useShellAccount>
    kids?: boolean
    seasonal?: SeasonalNav | null
}) {
    const t = useT()
    const likelyTv = useLikelyTv()
    const close = () => onOpenChange(false)
    const { active } = account
    const kids = kidsProp ?? active?.kids ?? false

    const yoursHrefs = YOURS.map((item) => item.href)
    const showFriends = !kids && yoursHrefs.includes('/friends')
    const showNight = !kids && yoursHrefs.includes('/movie-night')
    const browseRest = visibleItems(BROWSE.filter((item) => !TABS.some((tab) => tab.href === item.href)), kids)
    // Everything that isn't a tab: TV Shows, the world's hubs, Coming Soon, Top Rated, Surprise,
    // whatever of YOURS has no tile and isn't the library, then the season's place.
    const places: NavItem[] = [
        ...browseRest.slice(0, 1),
        ...visibleItems(WORLD, kids),
        ...browseRest.slice(1),
        ...visibleItems(YOURS, kids).filter((item) => !TILE_HREFS.includes(item.href) && item.href !== '/saved'),
        ...(seasonal && (!seasonal.signedInOnly || account.signedIn) ? [seasonalItem(seasonal)] : []),
    ]

    const place = (item: NavItem) => {
        const Icon = item.icon
        const content = (
            <>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.07] transition-colors group-active:bg-white/[0.12]">
                    <Icon aria-hidden className="h-[22px] w-[22px] text-white/85" strokeWidth={1.8} />
                </span>
                <span className="line-clamp-2 text-center text-[11.5px] leading-tight text-white/75">{t(item.label)}</span>
            </>
        )
        const className = 'group pressable flex flex-col items-center gap-1.5 rounded-2xl py-1 outline-none focus-visible:ring-2 focus-visible:ring-red-500'
        return item.plain
            ? <a key={item.href} href={item.href} className={className} onClick={close}>{content}</a>
            : <Link key={item.href} href={item.href} className={className} onClick={close}>{content}</Link>
    }

    return (
        <>
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent className="lg:hidden">
                    <DrawerTitle className="sr-only">{t('nav.menu')}</DrawerTitle>
                    <DrawerDescription className="sr-only">{t('nav.more')}</DrawerDescription>
                    <div className="no-scrollbar overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
                        {account.signedIn ? (
                            <div className="flex items-center gap-3">
                                {kids ? (
                                    // Kids profiles have no page: the row is just who's watching.
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <AccountAvatar active={active} image={account.avatarSrc} isOwner={account.isOwner} name={account.name} className="h-12 w-12 text-lg" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[17px] font-semibold">{active?.name ?? account.name ?? t('nav.myAccount')}</span>
                                            <KidsBadge label={t('profiles.kidsBadge')} className="mt-0.5 inline-block" />
                                        </span>
                                    </div>
                                ) : (
                                    <Link href="/me" onClick={close} className="pressable -m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                                        <AccountAvatar active={active} image={account.avatarSrc} isOwner={account.isOwner} name={account.name} className="h-12 w-12 text-lg" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[17px] font-semibold">{active?.name ?? account.name ?? t('nav.myAccount')}</span>
                                            <span className="mt-0.5 flex items-center gap-1 text-[13px] text-white/60">
                                                {t('social.menu.yourPage')}
                                                <ChevronRight aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
                                            </span>
                                        </span>
                                    </Link>
                                )}
                                <Link href="/profile" onClick={close} aria-label={t('nav.settings')} className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]">
                                    <Settings aria-hidden className="h-5 w-5" />
                                </Link>
                            </div>
                        ) : (
                            <div className="rounded-3xl bg-gradient-to-br from-red-600/25 via-white/[0.05] to-transparent p-5 ring-1 ring-white/10 rtl:bg-gradient-to-bl">
                                <p className="font-display text-2xl font-bold">{t('nav.signInTitle')}</p>
                                <p className="mt-1 text-sm text-white/70">{t('nav.signInText')}</p>
                                <div className="mt-4 flex gap-2">
                                    <Button asChild className="flex-1"><Link href="/login" onClick={close}>{t('nav.signIn')}</Link></Button>
                                    <Button asChild variant="secondary" className="flex-1"><Link href="/signup" onClick={close}>{t('nav.createAccount')}</Link></Button>
                                </div>
                            </div>
                        )}

                        {account.others.length > 0 && (
                            <div className="mt-4">
                                <p className="mb-2 text-xs font-medium text-white/50">{t('nav.switchProfile')}</p>
                                <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto overflow-y-hidden px-5">
                                    {account.others.map((profile) => (
                                        <button key={profile.id} type="button" onClick={() => account.switchTo(profile)} className="pressable flex w-16 shrink-0 flex-col items-center gap-1.5">
                                            <ProfileAvatar profile={profile} size="md" className="h-12 w-12 rounded-2xl text-lg" />
                                            <span className="w-full truncate text-center text-[11.5px] text-white/75">{profile.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(showFriends || showNight) && (
                            <div className="mt-6">
                                <p className="mb-2 text-xs font-medium text-white/50">{t('social.together.title')}</p>
                                <div className="grid grid-cols-2 gap-3 empty:hidden">
                                    {showFriends && <FriendsTile signedIn={account.signedIn} onNavigate={close} />}
                                    {showNight && <NightTile onNavigate={close} />}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 grid grid-cols-4 gap-x-2 gap-y-4">
                            {places.map(place)}
                        </div>

                        <p className="mb-2 mt-7 text-xs font-medium text-white/50">{t('nav.library')}</p>
                        <div className="overflow-hidden rounded-2xl bg-white/[0.05]">
                            {LIBRARY.map((item, index) => {
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={close}
                                        className={cn('flex h-[52px] items-center gap-3 px-4 outline-none transition-colors active:bg-white/[0.06] focus-visible:bg-white/[0.08]', index > 0 && 'border-t border-white/[0.06]')}
                                    >
                                        <Icon aria-hidden className="h-5 w-5 text-white/70" strokeWidth={1.8} />
                                        <span className="flex-1 text-[15px]">{t(item.label)}</span>
                                        <ChevronRight aria-hidden className="h-4 w-4 text-white/35 rtl:rotate-180" />
                                    </Link>
                                )
                            })}
                        </div>

                        <p className="mb-2 mt-7 text-xs font-medium text-white/50">{t('lang.label')}</p>
                        <LanguageSwitch stretch />

                        {likelyTv && (
                            <a href="/?tv=1" className="pressable mt-6 flex h-[52px] items-center gap-3 rounded-2xl bg-white/[0.05] px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                                <TvMinimal aria-hidden className="h-5 w-5 text-white/70" strokeWidth={1.8} />
                                <span className="flex-1">{t('social.menu.tvMode')}</span>
                                <ChevronRight aria-hidden className="h-4 w-4 text-white/35 rtl:rotate-180" />
                            </a>
                        )}

                        {account.signedIn && (
                            <button type="button" onClick={account.logOut} className="pressable mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.05] text-[15px] text-white/80">
                                <LogOut aria-hidden className="h-[18px] w-[18px]" />
                                {t('nav.logout')}
                            </button>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
            <KidsUnlockDialog profile={account.unlocking} onClose={() => account.setUnlocking(null)} onUnlocked={() => window.location.reload()} />
        </>
    )
}
