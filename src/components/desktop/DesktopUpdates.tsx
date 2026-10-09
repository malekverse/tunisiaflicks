"use client"
// The desktop app's updates, inside the app only (desktop/updater.js through the preload bridge):
// the automatic-updates switch, the installed version, "Check for updates" and, once a new
// version has downloaded, "Restart to update". Nothing outside the app, or in 1.0.0 (no updater).
import { CircleCheck, Download, RefreshCw, RotateCw, TriangleAlert } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { SwitchRow } from '@/src/components/ui/switch'
import SettingsSection, { SettingsGroup } from '@/src/components/profile/SettingsSection'
import { useDesktopUpdates, type DesktopUpdateState } from '@/src/hooks/use-desktop-app'
import { cn } from '@/src/lib/utils'

function Status({ state }: { state: DesktopUpdateState }) {
  const t = useT()
  const line = (icon: React.ReactNode, text: string, tone = 'text-white/60') => (
    <p role="status" className={cn('mt-1 inline-flex items-center gap-1.5 text-[13px]', tone)}>{icon}{text}</p>
  )
  switch (state.status) {
    case 'checking': return line(<RefreshCw aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />, t('desktop.updates.checking'))
    case 'downloading': return line(<Download aria-hidden className="h-3.5 w-3.5" />, t('desktop.updates.downloading', { version: state.version ?? '', percent: state.percent ?? 0 }))
    case 'ready': return line(<CircleCheck aria-hidden className="h-3.5 w-3.5" />, t('desktop.updates.ready', { version: state.version ?? '' }), 'text-emerald-300')
    case 'latest': return line(<CircleCheck aria-hidden className="h-3.5 w-3.5" />, t('desktop.updates.latest'))
    case 'error': return line(<TriangleAlert aria-hidden className="h-3.5 w-3.5" />, t('desktop.updates.error'), 'text-amber-300')
    case 'unsupported': return line(null, t('desktop.updates.unsupported'))
    default: return null
  }
}

type Updates = NonNullable<ReturnType<typeof useDesktopUpdates>>

/** The switch and the version row, in a settings group. */
function UpdatesGroup({ updates, className }: { updates: Updates, className?: string }) {
  const t = useT()
  const { state, setAuto, check, install } = updates
  const busy = state.status === 'checking' || state.status === 'downloading'

  return (
    <SettingsGroup className={className}>
      <SwitchRow
        id="desktop-auto-update"
        checked={state.auto}
        onCheckedChange={setAuto}
        disabled={state.status === 'unsupported'}
        label={t('desktop.updates.auto')}
        hint={t('desktop.updates.autoHint')}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 py-3.5">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-white">{t('desktop.updates.version', { version: state.current })}</p>
          <Status state={state} />
        </div>
        {state.status === 'ready' ? (
          <Button size="sm" className="h-10" onClick={install}>
            <RotateCw aria-hidden className="h-4 w-4" />{t('desktop.updates.restart')}
          </Button>
        ) : state.status !== 'unsupported' && (
          <Button size="sm" variant="secondary" className="h-10" disabled={busy} onClick={check}>
            <RefreshCw aria-hidden className="h-4 w-4" />{t('desktop.updates.check')}
          </Button>
        )}
      </div>
    </SettingsGroup>
  )
}

export default function DesktopUpdates({ className }: { className?: string }) {
  const updates = useDesktopUpdates()
  return updates ? <UpdatesGroup updates={updates} className={className} /> : null
}

/** Settings > Desktop app: the same, as its own section (only inside the app). */
export function DesktopAppSettings() {
  const t = useT()
  const updates = useDesktopUpdates()
  if (!updates) return null
  return (
    <SettingsSection id="desktop-app" title={t('desktop.updates.title')} description={t('desktop.updates.desc')}>
      <UpdatesGroup updates={updates} />
    </SettingsSection>
  )
}
