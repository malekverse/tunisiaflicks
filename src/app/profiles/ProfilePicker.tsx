"use client"
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { FaLock, FaPlus } from 'react-icons/fa'
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar'
import KidsUnlockDialog from '@/src/components/profiles/KidsUnlockDialog'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import { safeNext, selectProfile } from '@/src/hooks/use-profiles'
import { useT } from '@/src/components/I18nProvider'
import { MAX_PROFILES, type Profile, type ProfilesResponse } from '@/src/lib/models/Profile'

export default function ProfilePicker({ initial, ownerImage, next }: { initial: ProfilesResponse, ownerImage: string | null, next?: string }) {
  const { profiles, activeId, locked } = initial
  const [unlocking, setUnlocking] = useState<Profile | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const t = useT()

  const active = profiles.find((profile) => profile.id === activeId)
  const canManage = Boolean(active && !active.kids)

  // Full navigation: every list, row and the catalogue itself depend on the profile.
  const enter = useCallback(() => window.location.assign(safeNext(next)), [next])

  const pick = useCallback(async (profile: Profile) => {
    if (!profile.kids && locked) {
      setUnlocking(profile)
      return
    }
    setBusy(profile.id)
    const result = await selectProfile(profile.id)
    if (result.ok) return enter()
    setBusy(null)
    if (result.needsPassword) setUnlocking(profile)
    else toast({ title: t('common.error'), description: t('profiles.switchFailed'), variant: 'destructive' })
  }, [locked, enter, t])

  // Nothing to choose between: go straight in.
  const single = profiles.length === 1 && !locked ? profiles[0] : null
  useEffect(() => {
    if (single) pick(single)
  }, [single, pick])

  if (single) return <p className="text-gray-400 py-10">{t('common.loading')}</p>

  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-10 sm:py-16">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8 text-3xl font-bold sm:mb-12 sm:text-5xl"
      >
        {t('profiles.whoIsWatching')}
      </motion.h1>

      <ul className="flex flex-wrap justify-center gap-5 sm:gap-8">
        {profiles.map((profile, index) => (
          <motion.li key={profile.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}>
            <button
              type="button"
              onClick={() => pick(profile)}
              disabled={busy !== null}
              className="group flex w-24 flex-col items-center gap-3 rounded-xl focus:outline-none sm:w-32"
            >
              <span className={`relative rounded-xl ring-offset-4 ring-offset-white transition-all dark:ring-offset-[#0d0c0f] group-hover:ring-4 group-hover:ring-gray-400 group-focus-visible:ring-4 group-focus-visible:ring-red-500 dark:group-hover:ring-white ${profile.id === activeId ? 'ring-2 ring-red-500' : ''} ${busy === profile.id ? 'animate-pulse' : ''}`}>
                <ProfileAvatar profile={profile} image={index === 0 ? ownerImage : null} size="lg" />
                {!profile.kids && locked && (
                  <span className="absolute bottom-1.5 end-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white">
                    <FaLock aria-label={t('profiles.needsPassword')} />
                  </span>
                )}
              </span>
              <span className="flex flex-col items-center gap-1">
                <span className="max-w-full truncate text-sm text-gray-500 transition-colors group-hover:text-black dark:text-gray-400 dark:group-hover:text-white sm:text-base">{profile.name}</span>
                {profile.kids && <KidsBadge label={t('profiles.kidsBadge')} />}
              </span>
            </button>
          </motion.li>
        ))}

        {canManage && profiles.length < MAX_PROFILES && (
          <li>
            <Link href="/profile#profiles" className="group flex w-24 flex-col items-center gap-3 rounded-xl focus:outline-none sm:w-32">
              <span className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-500 text-3xl text-gray-500 transition-colors group-hover:border-red-500 group-hover:text-red-500 sm:h-32 sm:w-32">
                <FaPlus />
              </span>
              <span className="text-sm text-gray-500 group-hover:text-red-500 sm:text-base">{t('profiles.addProfile')}</span>
            </Link>
          </li>
        )}
      </ul>

      {canManage && (
        <Link href="/profile#profiles" className="mt-10 sm:mt-14">
          <Button variant="outline" className="border-gray-500 px-6 uppercase tracking-widest text-gray-500 hover:border-red-500 hover:bg-transparent hover:text-red-500">
            {t('profiles.manage')}
          </Button>
        </Link>
      )}

      <KidsUnlockDialog profile={unlocking} onClose={() => setUnlocking(null)} onUnlocked={enter} />
    </div>
  )
}
