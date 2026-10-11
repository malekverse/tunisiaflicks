"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/src/components/I18nProvider'
import { SwitchRow } from '@/src/components/ui/switch'
import { toast } from '@/src/hooks/use-toast'
import SettingsSection, { SettingsGroup } from './SettingsSection'

/**
 * Settings > Halal mode, for the profile in use (it follows the profile to every device). A Kids
 * profile sees it but can't change it. The catalogue refilters as soon as it's saved.
 */
export default function HalalSettings({ profileId, profileName, initial, kids }: {
  profileId: string
  profileName: string
  initial: boolean
  kids: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [saving, setSaving] = useState(false)

  const change = async (next: boolean) => {
    setOn(next)
    setSaving(true)
    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ halal: next }),
      })
      if (!response.ok) throw new Error(String(response.status))
      toast({ title: t(next ? 'halal.settings.on' : 'halal.settings.off'), duration: 2500 })
      router.refresh()
    } catch {
      setOn(!next)
      toast({ title: t('common.error'), variant: 'destructive', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection id="halal" title={t('halal.settings.title')} description={t('halal.settings.desc')}>
      <SettingsGroup>
        <SwitchRow
          id="setting-halal"
          checked={on}
          onCheckedChange={change}
          disabled={saving || kids}
          label={t('halal.settings.switch', { name: profileName })}
          hint={kids ? t('halal.settings.kids') : t('halal.settings.hint')}
        />
      </SettingsGroup>
      <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-white/45">{t('halal.settings.how')}</p>
    </SettingsSection>
  )
}
