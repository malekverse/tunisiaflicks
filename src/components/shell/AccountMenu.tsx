"use client"
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bookmark, Heart, LogOut, Settings, Users } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu'
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar'
import KidsUnlockDialog from '@/src/components/profiles/KidsUnlockDialog'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import AccountAvatar from './AccountAvatar'
import { useShellAccount } from './use-shell-account'

/** Desktop: the avatar in the top bar, with profile switching and the account shortcuts. */
export default function AccountMenu() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const account = useShellAccount()

  if (account.status === 'loading') return <span aria-hidden className="h-9 w-9 rounded-full bg-white/[0.06]" />
  if (!account.signedIn) {
    // On the sign-in pages themselves the form is the call to action.
    if (/^\/(login|signup|auth)(\/|$)/.test(pathname)) return null
    return (
      <Button asChild size="sm" className="px-5">
        <Link href="/login">{t('nav.signIn')}</Link>
      </Button>
    )
  }

  const { active } = account
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('nav.accountMenu')}
          className="pressable flex items-center gap-2 rounded-full p-0.5 outline-none ring-offset-2 ring-offset-black transition-shadow hover:ring-2 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <AccountAvatar active={active} image={account.avatarSrc} isOwner={account.isOwner} name={account.name} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={10} className="w-64">
          <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2.5">
            <AccountAvatar active={active} image={account.avatarSrc} isOwner={account.isOwner} name={account.name} className="h-10 w-10" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{active?.name ?? account.name ?? t('nav.myAccount')}</span>
              {active?.kids && <KidsBadge label={t('profiles.kidsBadge')} className="mt-0.5 inline-block" />}
            </span>
          </DropdownMenuLabel>
          {account.others.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs font-medium text-white/50">{t('nav.switchProfile')}</DropdownMenuLabel>
              {account.others.map((profile) => (
                <DropdownMenuItem key={profile.id} onSelect={() => account.switchTo(profile)} className="gap-3">
                  <ProfileAvatar profile={profile} size="sm" className="rounded-full" />
                  <span className="truncate">{profile.name}</span>
                  {profile.kids && <KidsBadge label={t('profiles.kidsBadge')} className="ms-auto" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          {active && !active.kids && (
            <DropdownMenuItem onSelect={() => router.push('/profile#profiles')} className="gap-3"><Users className="h-4 w-4 text-white/60" />{t('nav.manageProfiles')}</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => router.push('/favorites')} className="gap-3"><Heart className="h-4 w-4 text-white/60" />{t('nav.favorites')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/saved')} className="gap-3"><Bookmark className="h-4 w-4 text-white/60" />{t('nav.bookmarked')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/profile')} className="gap-3"><Settings className="h-4 w-4 text-white/60" />{t('nav.settings')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={account.logOut} className="gap-3"><LogOut className="h-4 w-4 text-white/60" />{t('nav.logout')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <KidsUnlockDialog profile={account.unlocking} onClose={() => account.setUnlocking(null)} onUnlocked={() => window.location.reload()} />
    </>
  )
}
