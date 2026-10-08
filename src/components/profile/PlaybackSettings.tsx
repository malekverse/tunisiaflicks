"use client"
import { SwitchRow } from '@/src/components/ui/switch'
import { useT } from '@/src/components/I18nProvider'
import { useAutoplayPreference } from '@/src/hooks/use-autoplay'
import { SettingsGroup } from './SettingsSection'

/** Settings > Playback: whether trailers may start on their own (saved on this device). */
export default function PlaybackSettings() {
  const t = useT()
  const [autoplay, setAutoplay] = useAutoplayPreference()
  return (
    <SettingsGroup>
      <SwitchRow
        id="setting-autoplay"
        checked={autoplay}
        onCheckedChange={setAutoplay}
        label={t('settings.autoplay')}
        hint={t('settings.autoplayHint')}
      />
    </SettingsGroup>
  )
}
