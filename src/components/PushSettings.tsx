"use client"
import React, { useEffect, useState } from 'react'
import { FaBell } from 'react-icons/fa6'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { usePush, type PushTopic } from '@/src/hooks/use-push'
import type { TKey } from '@/src/lib/i18n'

function Toggle({ checked, disabled, onChange, label, hint }: { checked: boolean, disabled?: boolean, onChange: (value: boolean) => void, label: string, hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-red-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'start-[1.375rem]' : 'start-0.5'}`} />
      </button>
    </label>
  )
}

const STATUS_MESSAGE: Partial<Record<string, TKey>> = {
  unsupported: 'push.unsupported',
  disabled: 'push.unavailable',
  denied: 'push.denied',
}

/** Profile page card: which notifications this device receives. */
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
    <section className="mt-8 rounded-2xl border border-gray-200 p-5 dark:border-zinc-800">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><FaBell className="text-red-500" />{t('push.title')}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('push.description')}</p>
      {status === 'loading' ? null : message ? (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">{t(message)}</p>
      ) : (
        <div className="mt-3 divide-y divide-gray-200 dark:divide-zinc-800">
          <Toggle checked={topics.includes('pick')} disabled={busy} onChange={(on) => toggle('pick', on)} label={t('push.pickLabel')} hint={t('push.pickHint')} />
          <Toggle checked={topics.includes('alerts')} disabled={busy} onChange={(on) => toggle('alerts', on)} label={t('push.alertsLabel')} hint={t('push.alertsHint')} />
        </div>
      )}
    </section>
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
    <div className="flex flex-col gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center">
      <FaBell className="hidden shrink-0 text-2xl text-red-500 sm:block" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">{t('push.promptTitle')}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('push.promptText')}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={enable} disabled={busy} className="bg-red-500 text-white hover:bg-red-400">{t('push.turnOn')}</Button>
        <Button variant="ghost" onClick={dismiss}>{t('push.notNow')}</Button>
      </div>
    </div>
  )
}
