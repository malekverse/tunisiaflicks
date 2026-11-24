"use client"
// Screen time's parts (lib/screen-time): in the player's place once a Kids profile's time is up or
// it's bedtime, the heads-up a few minutes before, and the settings a grown-up sets on a Kids
// profile (Settings > Profiles).
import React, { useState } from 'react'
import { Clock, MoonStar, Sun } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { useDir, useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { BEDTIMES, LIMITS, SOON_MINUTES, WAKE, type ScreenState, type ScreenTime } from '@/src/lib/screen-time'

/** In the player's place: a friendly stop, never a punishment. */
export function ScreenTimeUp({ stop, wake }: { stop: 'limit' | 'bedtime', wake: string }) {
  const t = useT()
  const Icon = stop === 'bedtime' ? MoonStar : Sun
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-indigo-950 via-black to-black px-6 text-center">
      <div className="flex max-w-md flex-col items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.08] ring-1 ring-white/15">
          <Icon aria-hidden className="h-8 w-8 text-amber-200" />
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold text-white">{t(stop === 'bedtime' ? 'screen.bedtimeTitle' : 'screen.limitTitle')}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">
          {stop === 'bedtime' ? t('screen.bedtimeText', { time: wake }) : t('screen.limitText')}
        </p>
        <p className="mt-4 text-[13px] text-white/45">{t('screen.grownUp')}</p>
      </div>
    </div>
  )
}

/** A few minutes before the end, over the player. */
export function ScreenTimeSoon({ state }: { state: ScreenState }) {
  const t = useT()
  if (state.stop || state.left === null || state.left > SOON_MINUTES) return null
  return (
    <p role="status" className="glass-strong pointer-events-none absolute end-[3%] top-[4%] z-30 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13.5px] font-medium text-white">
      <Clock aria-hidden className="h-4 w-4 text-amber-200" />
      {t('screen.soon', { count: Math.max(1, Math.ceil(state.left)) })}
    </p>
  )
}

const OFF = 'off'

/** On a Kids profile's card: its daily limit and its bedtime. */
export function ScreenTimeSettings({ profileId, profileName, initial }: { profileId: string, profileName: string, initial: ScreenTime | null | undefined }) {
  const t = useT()
  const dir = useDir()
  const [value, setValue] = useState<ScreenTime | null>(initial ?? null)
  const [saving, setSaving] = useState(false)

  const save = async (next: ScreenTime | null) => {
    const before = value
    setValue(next)
    setSaving(true)
    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenTime: next ?? null }),
      })
      if (!response.ok) throw new Error(String(response.status))
      toast({ title: t('screen.saved', { name: profileName }), duration: 2500 })
    } catch {
      setValue(before)
      toast({ title: t('common.error'), variant: 'destructive', duration: 3000 })
    } finally {
      setSaving(false)
    }
  }
  const change = (patch: Partial<ScreenTime>) => {
    const next = { limit: value?.limit ?? null, bedtime: value?.bedtime ?? null, wake: value?.wake ?? WAKE, ...patch }
    save(next.limit === null && next.bedtime === null ? null : next)
  }
  const hours = (minutes: number) => (minutes < 60 ? t('screen.minutes', { count: minutes }) : minutes % 60 ? t('screen.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 }) : t('screen.hours', { count: minutes / 60 }))

  return (
    <div className="rounded-[16px] bg-white/[0.04] p-3.5 ring-1 ring-inset ring-white/[0.06]">
      <p className="text-[14px] font-medium text-white">{t('screen.title')}</p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">{t('screen.desc')}</p>
      <div className="mt-3 grid gap-3">
        <label className="grid min-w-0 gap-1.5 text-[12.5px] text-white/60">
          {t('screen.limit')}
          <Select dir={dir} disabled={saving} value={value?.limit ? String(value.limit) : OFF} onValueChange={(next) => change({ limit: next === OFF ? null : Number(next) })}>
            <SelectTrigger className="h-10 w-full min-w-0" aria-label={t('screen.limit')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={OFF}>{t('screen.noLimit')}</SelectItem>
              {LIMITS.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{t('screen.perDay', { time: hours(minutes) })}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-[12.5px] text-white/60">
          {t('screen.bedtime')}
          <Select dir={dir} disabled={saving} value={value?.bedtime ?? OFF} onValueChange={(next) => change({ bedtime: next === OFF ? null : next })}>
            <SelectTrigger className="h-10 w-full min-w-0" aria-label={t('screen.bedtime')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={OFF}>{t('screen.noBedtime')}</SelectItem>
              {BEDTIMES.map((time) => <SelectItem key={time} value={time}>{t('screen.fromTo', { from: time, to: value?.wake ?? WAKE })}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  )
}
