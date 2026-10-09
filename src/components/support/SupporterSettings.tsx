"use client"
// Settings #supporter ("Supporter", for the account): whether the account supports us and since
// when, and for supporters the two choices that make it visible: the badge on the owner's page and
// a name on the /support thank-you list (30 characters, saved when the field is left). Mounted in
// src/app/profile/page.tsx for grown-ups.
import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, RotateCw } from 'lucide-react'
import SettingsSection, { SettingsGroup } from '@/src/components/profile/SettingsSection'
import BadgeArt from '@/src/components/badges/BadgeArt'
import { Button } from '@/src/components/ui/button'
import { TOUCH } from '@/src/components/badges/touch'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Skeleton } from '@/src/components/ui/skeleton'
import { SwitchRow } from '@/src/components/ui/switch'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { formatDate } from '@/src/lib/i18n/format'
import { richT } from '@/src/lib/i18n/rich'
import { LIST_NAME_MAX } from '@/src/lib/badges/kofi'
import { useSupporter } from './use-supporter'

function NameField({ value, onSave }: { value: string; onSave: (name: string) => Promise<boolean> }) {
  const { t } = useI18n()
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 2200)
    return () => clearTimeout(timer)
  }, [saved])

  const commit = async () => {
    const name = draft.replace(/\s+/g, ' ').trim()
    if (name === value) return
    setFailed(false)
    const ok = await onSave(name)
    if (ok) setSaved(true)
    else setFailed(true)
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-[13px] text-white/70">{t('support.settings.nameLabel')}</Label>
        <span aria-live="polite" className="inline-flex min-h-[18px] items-center gap-1 text-[12.5px] text-white/60">
          {saved && <><Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />{t('support.settings.nameSaved')}</>}
        </span>
      </div>
      <Input
        id={id}
        dir="auto"
        value={draft}
        maxLength={LIST_NAME_MAX}
        autoComplete="nickname"
        enterKeyHint="done"
        aria-describedby={`${id}-hint`}
        aria-invalid={failed || undefined}
        onChange={(event) => { setDraft(event.target.value); setSaved(false) }}
        onBlur={() => void commit()}
        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
        className="mt-2"
      />
      {failed
        ? <p className="mt-1.5 text-[13px] text-red-400">{t('support.settings.failed')}</p>
        : <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-white/55">{t('support.settings.nameHint', { max: LIST_NAME_MAX })}</p>}
    </div>
  )
}

export default function SupporterSettings(): JSX.Element | null {
  const { t, locale } = useI18n()
  const { status, state, load, save } = useSupporter()
  if (status === 'hidden') return null

  const supporter = state?.supporter ?? null
  const toggle = async (prefs: { badgePublic?: boolean; listed?: boolean }) => {
    if (!(await save(prefs))) toast({ variant: 'destructive', title: t('support.settings.failed') })
  }

  return (
    <SettingsSection id="supporter" title={t('badges.supporter.title')} description={t('support.settings.desc')}>
      {status === 'loading' && (
        <SettingsGroup aria-busy>
          <div className="flex items-center gap-4 py-4">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-3/5 rounded-full" />
          </div>
        </SettingsGroup>
      )}

      {status === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-white/60">{t('support.status.loadFailed')}</p>
          <Button type="button" size="sm" variant="secondary" className={TOUCH} onClick={() => void load()}>
            <RotateCw aria-hidden className="h-3.5 w-3.5" />{t('support.status.retry')}
          </Button>
        </div>
      )}

      {status === 'ready' && state && (
        <SettingsGroup>
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <BadgeArt id="supporter" level={supporter ? 3 : 0} size={44} />
              <p className="min-w-0 text-[14.5px] leading-snug text-white/80">
                {supporter
                  ? richT(t, 'support.status.yes', { date: formatDate(supporter.since, locale, { month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' }) })
                  : t(state.open ? 'support.status.no' : 'support.status.closed')}
              </p>
            </div>
            {!supporter && state.open && (
              <Button asChild size="sm" variant="secondary" className={`${TOUCH} shrink-0 self-start sm:self-auto`}>
                <Link href="/support">{t('support.status.cta')}<ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" /></Link>
              </Button>
            )}
          </div>
          {supporter && (
            <>
              <SwitchRow
                id="supporter-badge"
                checked={supporter.badgePublic}
                onCheckedChange={(value) => void toggle({ badgePublic: value })}
                label={t('support.settings.showBadge')}
                hint={t('support.settings.showBadgeHint')}
              />
              <SwitchRow
                id="supporter-listed"
                checked={supporter.listed}
                onCheckedChange={(value) => void toggle({ listed: value })}
                label={t('support.settings.thank')}
                hint={t('support.settings.thankHint')}
              />
              {supporter.listed && <NameField value={supporter.listName} onSave={(listName) => save({ listName })} />}
            </>
          )}
        </SettingsGroup>
      )}
    </SettingsSection>
  )
}
