"use client"
import React, { useEffect, useState } from 'react'
import { BellRing, Info, Smartphone } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { SwitchRow } from '@/src/components/ui/switch'
import SettingsSection, { SettingsGroup } from '@/src/components/profile/SettingsSection'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { usePush, type PushTopic } from '@/src/hooks/use-push'
import type { TKey } from '@/src/lib/i18n'

function Toggle({ id, checked, disabled, onChange, label, hint }: { id: string, checked: boolean, disabled?: boolean, onChange: (value: boolean) => void, label: string, hint: string }) {
  return <SwitchRow id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} label={label} hint={hint} />
}

const STATUS_MESSAGE: Partial<Record<string, TKey>> = {
  unsupported: 'push.unsupported',
  disabled: 'push.unavailable',
  denied: 'push.denied',
}

/** Settings > Notifications (#notifications): which notifications this device receives. */
export function PushSettingsCard() {
  const t = useT()
  const { status, topics, busy, update } = usePush()

  const toggle = async (topic: PushTopic, on: boolean) => {
    const next = on ? Array.from(new Set([...topics, topic])) : topics.filter((item) => item !== topic)
    const ok = await update(next)
    if (ok && on) toast({ title: t('push.enabled'), duration: 3000 })
    else if (!ok) toast({ title: t('push.failed'), variant: 'destructive', duration: 4000 })
  }

  const message = STATUS_MESSAGE[status]
  return (
    <SettingsSection id="notifications" title={t('settings.notifications')} description={t('push.description')}>
      <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-white/60">
        <Smartphone aria-hidden className="h-4 w-4" strokeWidth={1.9} />{t('push.title')}
      </p>
      {status === 'loading' ? (
        <SettingsGroup aria-busy>
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-5 py-4">
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3 rounded-full" /><Skeleton className="h-3 w-2/3 rounded-full" /></div>
              <Skeleton className="h-[30px] w-[50px] rounded-full" />
            </div>
          ))}
        </SettingsGroup>
      ) : message ? (
        <p className="flex items-start gap-3 rounded-2xl bg-amber-400/[0.07] p-4 text-[14px] leading-relaxed text-amber-100/85 ring-1 ring-inset ring-amber-300/15">
          <Info aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-300" />{t(message)}
        </p>
      ) : (
        <SettingsGroup>
          <Toggle id="push-pick" checked={topics.includes('pick')} disabled={busy} onChange={(on) => toggle('pick', on)} label={t('push.pickLabel')} hint={t('push.pickHint')} />
          <Toggle id="push-alerts" checked={topics.includes('alerts')} disabled={busy} onChange={(on) => toggle('alerts', on)} label={t('push.alertsLabel')} hint={t('push.alertsHint')} />
        </SettingsGroup>
      )}
    </SettingsSection>
  )
}

const DISMISSED = 'tf-push-prompt-dismissed'

/**
 * Home page invitation, only inside the installed app (standalone display) and only while the
 * user hasn't decided yet. "Not now" hides it for good on this device.
 */
export function PushPrompt() {
  const t = useT()
  const { status, topics, busy, update } = usePush()
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISSED) === '1' } catch { /* show it */ }
    setEligible(standalone && !dismissed && 'Notification' in window && Notification.permission === 'default')
  }, [])

  if (!eligible || status !== 'ready' || topics.length > 0) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED, '1') } catch { /* fine */ }
    setEligible(false)
  }
  const enable = async () => {
    if (await update(['pick', 'alerts'])) toast({ title: t('push.enabled'), duration: 3000 })
    dismiss()
  }

  return (
    <div className="page-x">
      <div className="flex flex-col gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.08] sm:flex-row sm:items-center">
        <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-400 sm:grid">
          <BellRing aria-hidden className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-bold">{t('push.promptTitle')}</p>
          <p className="text-sm text-white/60">{t('push.promptText')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={enable} disabled={busy}>{t('push.turnOn')}</Button>
          <Button variant="ghost" onClick={dismiss}>{t('push.notNow')}</Button>
        </div>
      </div>
    </div>
  )
}
