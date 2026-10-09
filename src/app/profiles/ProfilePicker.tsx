"use client"
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Lock, Plus, Settings2 } from 'lucide-react'
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar'
import KidsUnlockDialog from '@/src/components/profiles/KidsUnlockDialog'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import { safeNext, selectProfile } from '@/src/hooks/use-profiles'
import { useT } from '@/src/components/I18nProvider'
import { haptic } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { MAX_PROFILES, type Profile, type ProfilesResponse } from '@/src/lib/models/Profile'
import { BrandLoader } from '@/src/components/brand/BrandMark'

// Each tile comes into focus a beat after the previous one (capped, so six profiles still feel quick).
const delay = (index: number) => ({ animationDelay: `${180 + Math.min(index, 6) * 40}ms` })

const TILE = 'h-[104px] w-[104px] rounded-[26px] sm:h-[148px] sm:w-[148px] sm:rounded-[34px]'
const ITEM = 'flex w-[124px] flex-col items-center gap-3.5 sm:w-[168px] sm:gap-4'

/**
 * "Who's watching?": a full-screen moment over the whole app (rail and bars included), like
 * the lights going down before the film. Big tiles, each with its name; picking one reloads the
 * app into that profile.
 */
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

  if (single) {
    return (
      <div role="status" className="fixed inset-0 z-[55] grid place-items-center bg-black">
        <BrandLoader tone="brand" className="h-9 w-9" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    )
  }

  const canAdd = canManage && profiles.length < MAX_PROFILES

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto overscroll-contain bg-black">
      {/* One soft light from above: the room before the film starts. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgb(255_255_255/0.08),transparent_70%)]" />

      <div className="relative flex min-h-full flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+28px)] pt-[calc(env(safe-area-inset-top,0px)+22px)] sm:px-10">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <Image src="/A.svg" alt="" width={28} height={24} priority className="h-6 w-auto" />
          <Image src="/TunisiaFlicks.svg" alt="TunisiaFlicks" width={120} height={16} priority className="h-[14px] w-auto" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-12">
          <h1 className="animate-focus-in text-balance text-center font-display text-[clamp(36px,6vw,76px)] font-extrabold leading-[0.95] text-white">
            {t('profiles.whoIsWatching')}
          </h1>

          <ul className="mt-10 flex max-w-5xl flex-wrap justify-center gap-x-4 gap-y-9 sm:mt-16 sm:gap-x-8 sm:gap-y-12">
            {profiles.map((profile, index) => {
              const current = profile.id === activeId
              const loading = busy === profile.id
              return (
                <li key={profile.id} className="animate-focus-in" style={delay(index)}>
                  <button
                    type="button"
                    onClick={() => { haptic(10); pick(profile) }}
                    disabled={busy !== null}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      ITEM,
                      'group/profile select-none outline-none transition-opacity duration-300 [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] disabled:cursor-default',
                      busy !== null && !loading && 'opacity-35',
                    )}
                  >
                    <span
                      className={cn(
                        'relative block transition-[transform,box-shadow] duration-300 ease-out',
                        'shadow-[0_0_0_0_transparent] group-hover/profile:-translate-y-1.5 group-hover/profile:shadow-[0_0_0_3px_#000,0_0_0_5px_rgb(255_255_255/0.9),0_24px_50px_-18px_rgb(0_0_0/0.9)] group-focus-visible/profile:shadow-[0_0_0_3px_#000,0_0_0_5px_#FF2414] group-active/profile:scale-[0.96]',
                        current && 'shadow-[0_0_0_3px_#000,0_0_0_5px_rgb(255_36_20/0.85)]',
                        TILE,
                      )}
                    >
                      <ProfileAvatar profile={profile} image={index === 0 ? ownerImage : null} size="lg" />
                      {!profile.kids && locked && (
                        <span className="glass absolute bottom-2 end-2 grid h-8 w-8 place-items-center rounded-full text-white sm:bottom-2.5 sm:end-2.5">
                          <Lock aria-label={t('profiles.needsPassword')} className="h-4 w-4" strokeWidth={2.2} />
                        </span>
                      )}
                      {loading && (
                        <span className={cn('absolute inset-0 grid place-items-center bg-black/45', TILE)}>
                          <BrandLoader tone="brand" className="h-8 w-8" />
                        </span>
                      )}
                    </span>
                    <span className="flex max-w-full flex-col items-center gap-1.5">
                      <span className="max-w-full truncate text-[15px] text-white/65 transition-colors duration-200 group-hover/profile:text-white group-focus-visible/profile:text-white sm:text-lg">{profile.name}</span>
                      {profile.kids && <KidsBadge label={t('profiles.kidsBadge')} />}
                    </span>
                  </button>
                </li>
              )
            })}

            {canAdd && (
              <li className="animate-focus-in" style={delay(profiles.length)}>
                <Link href="/profile#profiles" className={cn(ITEM, 'group/profile select-none outline-none')}>
                  <span
                    className={cn(
                      'grid place-items-center border-2 border-dashed border-white/20 bg-white/[0.03] text-white/55 transition-[transform,border-color,background-color,color] duration-300 ease-out group-hover/profile:-translate-y-1.5 group-hover/profile:border-white/60 group-hover/profile:bg-white/[0.07] group-hover/profile:text-white group-focus-visible/profile:border-red-500 group-active/profile:scale-[0.96]',
                      TILE,
                    )}
                  >
                    <Plus aria-hidden className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={1.6} />
                  </span>
                  <span className="text-[15px] text-white/55 transition-colors duration-200 group-hover/profile:text-white sm:text-lg">{t('profiles.addProfile')}</span>
                </Link>
              </li>
            )}
          </ul>

          {canManage && (
            <div className="mt-14 animate-focus-in sm:mt-16" style={delay(profiles.length + 1)}>
              <Button asChild variant="secondary" size="lg">
                <Link href="/profile#profiles"><Settings2 aria-hidden className="h-[18px] w-[18px]" />{t('profiles.manage')}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <KidsUnlockDialog profile={unlocking} onClose={() => setUnlocking(null)} onUnlocked={enter} />
    </div>
  )
}
