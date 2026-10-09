"use client"
// Settings #display (rendered by LanguageSettings): the "TV mode" switch for this device, and in
// TV mode a big [Exit TV mode] (the TV bar's Settings item lands here). Inside the Android TV app
// the app is TV mode, so neither shows there. Then a link to /app.
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, LogOut, MonitorDown } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { SettingsGroup } from '@/src/components/profile/SettingsSection'
import { SwitchRow } from '@/src/components/ui/switch'
import { toast } from '@/src/hooks/use-toast'
import { useInTvApp, useTvMode } from '@/src/hooks/use-tv-mode'

export async function setTvMode(on: boolean): Promise<boolean> {
  const response = await fetch('/api/tv-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on }),
  }).catch(() => null)
  return !!response?.ok
}

export default function TvModeSetting(): JSX.Element | null {
  const t = useT()
  const tv = useTvMode()
  const inApp = useInTvApp()
  const [on, setOn] = useState(tv)
  const [busy, setBusy] = useState(false)

  if (inApp) return null

  const change = async (next: boolean) => {
    setBusy(true)
    setOn(next)
    if (await setTvMode(next)) {
      // The shell is chosen on the server: load the page again in the new mode.
      window.location.reload()
      return
    }
    setOn(!next)
    setBusy(false)
    toast({ title: t('common.error'), description: t('tvMode.setting.failed'), variant: 'destructive' })
  }

  return (
    <div className="space-y-4">
      {tv && (
        <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-inset ring-white/[0.05] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-white">{t('tvMode.setting.label')}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/55">{t('tvMode.setting.exitHint')}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => change(false)}
            className="pressable inline-flex h-14 shrink-0 items-center justify-center gap-3 rounded-full bg-white px-8 text-[17px] font-semibold text-black outline-none transition-opacity disabled:opacity-60"
          >
            <LogOut aria-hidden className="h-5 w-5 rtl:rotate-180" />
            {t('tvMode.setting.exit')}
          </button>
        </div>
      )}
      <SettingsGroup>
        {!tv && (
          <SwitchRow
            id="setting-tv-mode"
            checked={on}
            disabled={busy}
            onCheckedChange={change}
            label={t('tvMode.setting.label')}
            hint={t('tvMode.setting.hint')}
          />
        )}
        <Link
          href="/app"
          className="group/app -mx-1 flex items-center gap-3.5 rounded-xl px-1 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/80">
            <MonitorDown aria-hidden className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-white">{t('tvMode.setting.getApp')}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-white/55">{t('tvMode.setting.getAppHint')}</span>
          </span>
          <ChevronRight aria-hidden className="h-5 w-5 text-white/50 transition-transform duration-200 group-hover/app:translate-x-0.5 rtl:rotate-180 rtl:group-hover/app:-translate-x-0.5" />
        </Link>
      </SettingsGroup>
    </div>
  )
}
