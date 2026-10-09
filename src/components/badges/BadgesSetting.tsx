"use client"
// 'Badges and streak', mounted by social-pages inside Settings #privacy (a SettingsGroup row). Off:
// the private daily log is deleted, nothing more is written and the shelf is hidden; on again
// starts a fresh log. Grown-up profiles only: a Kids profile (and a guest) sees nothing.
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { TOUCH } from '@/src/components/badges/touch'
import { SwitchRow } from '@/src/components/ui/switch'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'

type State = { status: 'loading' } | { status: 'hidden' } | { status: 'error' } | { status: 'ready'; enabled: boolean }

export default function BadgesSetting(): JSX.Element | null {
  const t = useT()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/badges/settings', { cache: 'no-store' })
      // Guests, Kids profiles and no profile picked: nothing to show.
      if (response.status === 401 || response.status === 403 || response.status === 409) return setState({ status: 'hidden' })
      if (!response.ok) throw new Error(String(response.status))
      const body = await response.json()
      setState({ status: 'ready', enabled: body.enabled !== false })
    } catch {
      setState({ status: 'error' })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (state.status === 'hidden') return null
  if (state.status === 'loading') {
    return (
      <div aria-busy className="flex items-center justify-between gap-5 py-4">
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5 rounded-full" /><Skeleton className="h-3 w-3/4 rounded-full" /></div>
        <Skeleton className="h-[30px] w-[50px] rounded-full" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex items-center justify-between gap-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-white">{t('badges.setting.label')}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/55">{t('badges.setting.loadFailed')}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" className={TOUCH} onClick={() => { setState({ status: 'loading' }); void load() }}>
          {t('badges.error.retry')}
        </Button>
      </div>
    )
  }

  const enabled = state.enabled
  const toggle = async (next: boolean) => {
    if (saving) return
    setSaving(true)
    setState({ status: 'ready', enabled: next })
    try {
      const response = await fetch('/api/badges/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!response.ok) throw new Error(String(response.status))
    } catch {
      setState({ status: 'ready', enabled: !next })
      toast({ variant: 'destructive', title: t('badges.setting.failed') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SwitchRow
      id="badges-enabled"
      checked={enabled}
      disabled={saving}
      onCheckedChange={(value) => void toggle(value)}
      label={t('badges.setting.label')}
      hint={t('badges.setting.hint')}
    />
  )
}
