"use client"
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { globalStore } from '@/src/store/store'
import { forgetProfile, selectProfile, useProfiles } from '@/src/hooks/use-profiles'
import { useAccount } from '@/src/hooks/use-account'
import { toast } from '@/src/hooks/use-toast'
import { useT } from '@/src/components/I18nProvider'
import type { Profile } from '@/src/lib/models/Profile'

/**
 * Everything the account menus (desktop avatar menu, mobile menu sheet) need: who is signed in,
 * their picture, their viewer profiles, and the switch / sign-out actions.
 */
export function useShellAccount() {
  const { data: session, status } = useSession()
  const { account } = useAccount()
  const t = useT()
  const avatar = globalStore((state) => state.avatar)
  const { data: profiles, active } = useProfiles()
  const [unlocking, setUnlocking] = useState<Profile | null>(null)

  const avatarSrc = avatar || account?.image || session?.user?.image || null
  // The owner's profile (the first) keeps the account photo.
  const isOwner = !active || profiles?.profiles[0]?.id === active.id
  const others = profiles?.profiles.filter((profile) => profile.id !== active?.id) ?? []

  const switchTo = async (profile: Profile) => {
    if (!profile.kids && profiles?.locked) return setUnlocking(profile)
    const result = await selectProfile(profile.id)
    // Reload: every list, row and the catalogue itself depend on the profile.
    if (result.ok) window.location.reload()
    else if (result.needsPassword) setUnlocking(profile)
    else toast({ title: t('common.error'), description: t('profiles.switchFailed'), variant: 'destructive' })
  }

  const logOut = async () => {
    await forgetProfile()
    signOut()
  }

  return {
    session, status, signedIn: !!session, name: session?.user?.name ?? null,
    avatarSrc, isOwner, profiles, active, others, switchTo, logOut, unlocking, setUnlocking,
  }
}

/** Until a viewer profile is picked on this device, send the user to "Who's watching?". */
export function useProfileGate() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: profiles } = useProfiles()
  const needsPick = profiles?.needsPick ?? false
  useEffect(() => {
    if (needsPick && !/^\/(profiles|login|signup|auth)(\/|$)/.test(pathname)) {
      router.replace(`/profiles?next=${encodeURIComponent(pathname)}`)
    }
  }, [needsPick, pathname, router])
}
