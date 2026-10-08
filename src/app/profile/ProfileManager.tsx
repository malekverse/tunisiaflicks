"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Lock, Plus, Trash2 } from 'lucide-react'
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar'
import SettingsSection from '@/src/components/profile/SettingsSection'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Switch } from '@/src/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { toast } from '@/src/hooks/use-toast'
import { useProfiles } from '@/src/hooks/use-profiles'
import { MAX_PROFILES, MAX_PROFILE_NAME, PROFILE_COLORS, type Profile } from '@/src/lib/models/Profile'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'
import type { TKey, Translate } from '@/src/lib/i18n'

// The profiles API answers in English; these are the messages a user can trigger from this page.
const API_ERRORS: Record<string, TKey> = {
  'Keep at least one grown-up profile': 'profiles.keepGrownUp',
  'You already have a profile with that name': 'profiles.duplicateName',
  'Profile names need 1 to 20 characters': 'profiles.badName',
  [`An account can have up to ${MAX_PROFILES} profiles`]: 'profiles.tooMany',
}
const errorText = (t: Translate, error: unknown) =>
  t(API_ERRORS[(error as Error)?.message] ?? 'profiles.genericError', { max: MAX_PROFILES })

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error ?? 'Something went wrong')
  }
  return response.json()
}

function ColorPicker({ value, onChange }: { value: string, onChange: (color: string) => void }) {
  const t = useT()
  return (
    <div role="radiogroup" aria-label={t('profiles.avatarColour')} className="-mx-1.5 flex flex-wrap">
      {PROFILE_COLORS.map((color) => {
        const chosen = value === color
        return (
          // A 40px touch target around a 28px swatch.
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={t('profiles.colour', { color })}
            onClick={() => onChange(color)}
            className="group/swatch grid h-10 w-10 place-items-center rounded-full outline-none"
          >
            <span
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full transition-[transform,box-shadow] duration-200 ease-out group-hover/swatch:scale-110 group-active/swatch:scale-95 group-focus-visible/swatch:ring-2 group-focus-visible/swatch:ring-red-500',
                chosen && 'shadow-[0_0_0_2px_#0c0c0e,0_0_0_4px_rgb(255_255_255/0.9)]',
              )}
              style={{ backgroundColor: color }}
            >
              {chosen && <Check aria-hidden className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function KidsToggle({ id, checked, onChange, disabled }: { id: string, checked: boolean, onChange: (kids: boolean) => void, disabled?: boolean }) {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className={cn('min-w-0 text-[14px]', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
        <span className="block font-medium text-white">{t('profiles.kidsProfile')}</span>
        <span id={`${id}-hint`} className="mt-0.5 block text-[12.5px] leading-snug text-white/50">{t('profiles.kidsProfileDesc')}</span>
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={`${id}-hint`} />
    </div>
  )
}

function ProfileCard({ profile, isActive, isOwner, onlyGrownUp, onChanged, onDelete }: {
  profile: Profile
  isActive: boolean
  isOwner: boolean
  onlyGrownUp: boolean
  onChanged: (kidsChangedOnActive: boolean) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(profile.name)
  const [saving, setSaving] = useState(false)
  const t = useT()
  useEffect(() => setName(profile.name), [profile.name])

  const update = async (patch: Partial<Profile>) => {
    setSaving(true)
    try {
      await send(`/api/profiles/${profile.id}`, 'PATCH', patch)
      onChanged(isActive && patch.kids !== undefined)
    } catch (error) {
      toast({ title: t('common.error'), description: errorText(t, error), variant: 'destructive' })
      setName(profile.name)
    } finally {
      setSaving(false)
    }
  }

  const renamed = name.trim() !== profile.name

  return (
    <li className="rounded-[20px] bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06] sm:p-5">
      <div className="flex items-start gap-4">
        <ProfileAvatar profile={{ name: name || profile.name, color: profile.color }} size="md" className="h-14 w-14 rounded-2xl text-2xl" />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (renamed) update({ name })
              }}
            >
              <Input aria-label={t('profiles.nameOf', { name: profile.name })} value={name} maxLength={MAX_PROFILE_NAME} onChange={(event) => setName(event.target.value)} enterKeyHint="done" className="h-10 text-base sm:text-[15px]" />
              {renamed && <Button type="submit" disabled={saving} className="shrink-0">{t('profiles.save')}</Button>}
            </form>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-white/50">
              {isActive && (
                <span className="inline-flex items-center gap-1.5 font-medium text-white/85">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgb(255_36_20/0.8)]" />
                  {t('profiles.watchingNow')}
                </span>
              )}
              {isOwner && <span>{t('profiles.owner')}</span>}
              {profile.kids && <KidsBadge label={t('profiles.kidsBadge')} />}
            </div>
          </div>
          <ColorPicker value={profile.color} onChange={(color) => color !== profile.color && update({ color })} />
          <KidsToggle
            id={`kids-${profile.id}`}
            checked={profile.kids}
            disabled={saving || (!profile.kids && onlyGrownUp)}
            onChange={(kids) => update({ kids })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('profiles.delete', { name: profile.name })}
          title={onlyGrownUp && !profile.kids ? t('profiles.keepGrownUp') : t('profiles.delete', { name: profile.name })}
          disabled={onlyGrownUp && !profile.kids}
          onClick={onDelete}
          className="-me-2 -mt-1 h-11 w-11 shrink-0 text-white/50 hover:bg-red-600/15 hover:text-red-300"
        >
          <Trash2 aria-hidden className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </li>
  )
}

/** Create, rename, recolour, Kids toggle and delete profiles (grown-up profiles only). */
export default function ProfileManager() {
  const { data, active, reload } = useProfiles()
  const [deleting, setDeleting] = useState<Profile | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(PROFILE_COLORS[1])
  const [newKids, setNewKids] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useT()

  const section = (children: React.ReactNode) => (
    <SettingsSection id="profiles" title={t('profiles.title')} description={t('profiles.intro', { max: MAX_PROFILES })}>
      {children}
    </SettingsSection>
  )

  // Loading: hold the space, so the sections below (and /profile#following links) don't jump.
  if (!data) {
    return section(
      <div aria-busy className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((key) => <Skeleton key={key} className="h-[212px] rounded-[20px]" />)}
      </div>
    )
  }
  const profiles = data.profiles
  const grownUps = profiles.filter((profile) => !profile.kids).length

  if (!active || active.kids) {
    return section(
      <div className="flex flex-col items-start gap-4 rounded-[20px] bg-white/[0.03] p-5 ring-1 ring-inset ring-white/[0.06] sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><Lock aria-hidden className="h-5 w-5 text-white/80" /></span>
        <p className="flex-1 text-[14px] leading-relaxed text-white/70">{t('profiles.locked')}</p>
        <Button asChild><Link href="/profiles">{t('profiles.switchProfile')}</Link></Button>
      </div>
    )
  }

  const changed = (kidsChangedOnActive: boolean) => {
    // The catalogue follows the active profile's Kids setting: reload everything.
    if (kidsChangedOnActive) window.location.reload()
    else reload()
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    try {
      await send('/api/profiles', 'POST', { name: newName, color: newColor, kids: newKids })
      toast({ title: t('profiles.added'), description: t('profiles.addedDesc', { name: newName.trim() }) })
      setNewName('')
      setNewKids(false)
      setNewColor(PROFILE_COLORS[(profiles.length + 2) % PROFILE_COLORS.length])
      reload()
    } catch (error) {
      toast({ title: t('common.error'), description: errorText(t, error), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await send(`/api/profiles/${deleting.id}`, 'DELETE')
      toast({ title: t('profiles.deleted'), description: t('profiles.deletedDesc', { name: deleting.name }) })
      if (deleting.id === active.id) return window.location.assign('/profiles')
      setDeleting(null)
      reload()
    } catch (error) {
      toast({ title: t('common.error'), description: errorText(t, error), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return section(
    <>
      <ul className="grid gap-4 md:grid-cols-2">
        {profiles.map((profile, index) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            isActive={profile.id === active.id}
            isOwner={index === 0}
            onlyGrownUp={!profile.kids && grownUps <= 1}
            onChanged={changed}
            onDelete={() => setDeleting(profile)}
          />
        ))}

        {profiles.length < MAX_PROFILES && (
          <li className="rounded-[20px] border border-dashed border-white/15 p-4 sm:p-5">
            <form onSubmit={create} className="space-y-4">
              <h3 className="text-[15px] font-semibold text-white">{t('profiles.addAProfile')}</h3>
              <div className="flex items-center gap-4">
                <ProfileAvatar profile={{ name: newName.trim() || '+', color: newColor }} size="md" className="h-14 w-14 rounded-2xl text-2xl" />
                <Input aria-label={t('profiles.newName')} placeholder={t('profiles.name')} value={newName} maxLength={MAX_PROFILE_NAME} onChange={(event) => setNewName(event.target.value)} enterKeyHint="done" className="h-10 text-base sm:text-[15px]" />
              </div>
              <ColorPicker value={newColor} onChange={setNewColor} />
              <KidsToggle id="kids-new" checked={newKids} onChange={setNewKids} />
              <Button type="submit" disabled={busy || !newName.trim()} className="w-full">
                <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {t('profiles.addProfile')}
              </Button>
            </form>
          </li>
        )}
      </ul>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            {deleting && <ProfileAvatar profile={deleting} size="md" className="mb-2 h-14 w-14 rounded-2xl text-2xl max-sm:mx-auto" />}
            <DialogTitle className="font-display text-2xl font-bold">{t('profiles.deleteTitle', { name: deleting?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('profiles.deleteDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>{t('profiles.cancel')}</Button>
            <Button variant="destructive" disabled={busy} onClick={confirmDelete}><Trash2 aria-hidden className="h-4 w-4" />{t('profiles.deleteConfirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
