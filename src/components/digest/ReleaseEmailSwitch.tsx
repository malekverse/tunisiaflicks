"use client"
// "Release alerts by email" (account-wide), at the top of Settings #following. Mounted in
// src/app/profile/Following.tsx. Off: release alerts still reach the bell and this device's
// notifications, never the inbox. Grown-up profiles only (a Kids profile sees nothing here).
import { SettingsGroup } from '@/src/components/profile/SettingsSection'
import { SwitchRow } from '@/src/components/ui/switch'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { saveErrorMessage, useDigest } from '@/src/hooks/use-digest'
import { useProfiles } from '@/src/hooks/use-profiles'

export default function ReleaseEmailSwitch(): JSX.Element | null {
  const t = useT()
  const { status, state, saving, save } = useDigest()
  const { data: profiles, active } = useProfiles()

  // A Kids profile never sees it, not even the placeholder: nothing shows until the active profile
  // is known to be a grown-up one.
  if (!profiles || !active || active.kids) return null
  if (status === 'idle' || status === 'loading') {
    return (
      <SettingsGroup aria-busy>
        <div className="flex items-center justify-between gap-5 py-4">
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5 rounded-full" /><Skeleton className="h-3 w-1/4 rounded-full" /></div>
          <Skeleton className="h-[30px] w-[50px] rounded-full" />
        </div>
      </SettingsGroup>
    )
  }
  // Nothing to offer: signed out, couldn't load (the list below still works), or a Kids profile / TV.
  if (status !== 'ready' || !state || state.locked) return null

  const toggle = async (releaseAlerts: boolean) => {
    const error = saveErrorMessage(t, await save({ releaseAlerts }))
    if (error) return toast({ title: error, variant: 'destructive', duration: 4500 })
    toast(releaseAlerts
      ? { title: t('digest.release.on'), duration: 3000 }
      : { title: t('digest.release.off'), description: t('digest.release.offDesc'), duration: 4000 })
  }

  return (
    <SettingsGroup>
      <SwitchRow
        id="release-email"
        checked={state.releaseAlerts}
        disabled={!!saving.releaseAlerts}
        onCheckedChange={(value) => void toggle(value)}
        label={t('digest.release.label')}
        hint={t('digest.release.hint')}
      />
    </SettingsGroup>
  )
}
