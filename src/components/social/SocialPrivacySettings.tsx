// Settings #privacy, "Friends and privacy" (a SettingsSection id='privacy'): your page, who sees
// what, requests, pause, blocked people. Mounted in src/app/profile/page.tsx for grown-ups.
// Everything saves as it changes; a toast only when something couldn't be saved.
"use client"

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { AtSign, Check, Copy, EyeOff, Link2, RotateCw, ShieldOff, Trash2, UserRound } from 'lucide-react'
import BadgesSetting from '@/src/components/badges/BadgesSetting'
import { useI18n } from '@/src/components/I18nProvider'
import SettingsSection, { SettingsGroup } from '@/src/components/profile/SettingsSection'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { SwitchRow } from '@/src/components/ui/switch'
import { Textarea } from '@/src/components/ui/textarea'
import { toast } from '@/src/hooks/use-toast'
import { EASE_OUT, haptic } from '@/src/lib/motion'
import { BIO_MAX, NAME_MAX, checkHandle, normalizeHandle } from '@/src/lib/social/rules'
import { DEFAULT_PRIVACY, type PrivacySettings, type PublicIdentity, type Visibility } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'
import { UserAvatar } from './Avatar'
import { ConfirmDialog } from './PersonRow'
import ProfileSetupCard from './ProfileSetupCard'
import VisibilitySelect from './VisibilitySelect'
import { invalidateSocialSelf, socialErrorText, useSocialSelf } from './use-social-self'

type Blocked = { id: string; person: PublicIdentity | null }

const FIELD = 'h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[16px] text-white outline-none transition-[border-color,background-color,box-shadow] duration-200 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07] focus-visible:ring-4 focus-visible:ring-red-500/15'

/** A small heading above a group of rows. */
function GroupHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-white/60 [&_svg]:h-4 [&_svg]:w-4">
      <span aria-hidden>{icon}</span>{children}
    </p>
  )
}

/** A row whose control sits under its label (segmented controls, fields). */
function StackedRow({ label, hint, labelFor, children, end }: { label: React.ReactNode; hint?: React.ReactNode; labelFor?: string; children?: React.ReactNode; end?: React.ReactNode }) {
  const Label = labelFor ? 'label' : 'p'
  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <Label {...(labelFor ? { htmlFor: labelFor } : {})} className="text-[15px] font-medium text-white">{label}</Label>
        {end}
      </div>
      {hint && <p className="mt-0.5 text-[13px] leading-snug text-white/55">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

/** "Saved", for a moment, beside a field that saves on its own. */
function SavedMark({ show }: { show: boolean }) {
  const { t } = useI18n()
  return (
    <span aria-live="polite" className="inline-flex h-5 items-center">
      <AnimatePresence>
        {show && (
          <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }} transition={{ duration: 0.18, ease: EASE_OUT }} className="inline-flex items-center gap-1 text-[12.5px] text-white/60">
            <Check aria-hidden className="h-3.5 w-3.5" />{t('social.privacy.saved')}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  )
}

function useSavedFlash() {
  const [field, setField] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = useCallback((name: string) => {
    setField(name)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setField(null), 1800)
  }, [])
  return [field, flash] as const
}

/** Two or more choices, one under the other (labels too long for a segmented control on a phone). */
function RadioList<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: { value: V; label: string }[]; onChange: (value: V) => void }) {
  const { dir } = useI18n()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (index: number) => {
    const next = (index + options.length) % options.length
    refs.current[next]?.focus()
    onChange(options[next].value)
  }
  return (
    <div role="radiogroup" aria-label={label} className="space-y-1">
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => { if (!active) onChange(option.value) }}
            onKeyDown={(event) => {
              const forward = event.key === 'ArrowDown' || event.key === (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
              const backward = event.key === 'ArrowUp' || event.key === (dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft')
              if (!forward && !backward) return
              event.preventDefault()
              move(index + (forward ? 1 : -1))
            }}
            className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] select-none items-center gap-3 rounded-xl px-2 text-start text-[14.5px] outline-none transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
          >
            <span aria-hidden className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full ring-2 ring-inset transition-colors', active ? 'bg-white ring-white' : 'ring-white/30')}>
              {active && <span className="h-2 w-2 rounded-full bg-black" />}
            </span>
            <span className={active ? 'text-white' : 'text-white/75'}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The handle and its editor: availability checked as you type, once every 30 days. */
function HandleRow({ handle, changeAt, onChanged }: { handle: string; changeAt: string | null; onChanged: (identity: PublicIdentity) => void }) {
  const { t, dateLocale } = useI18n()
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(handle)
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved' | 'same'>('same')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<string | null>(changeAt)
  const attempt = useRef(0)
  useEffect(() => setLockedUntil(changeAt), [changeAt])

  useEffect(() => {
    if (!editing) return
    const next = normalizeHandle(value) ?? ''
    const run = ++attempt.current
    if (next === handle) return setState('same')
    const problem = checkHandle(next)
    if (problem) return setState(problem)
    setState('checking')
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/social/handle?h=${encodeURIComponent(next)}`, { cache: 'no-store' })
        const body = await response.json().catch(() => ({}))
        if (run !== attempt.current) return
        if (!response.ok) return setState('idle')
        setState(body.available ? 'available' : body.reason ?? 'taken')
      } catch {
        if (run === attempt.current) setState('idle')
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [value, editing, handle])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (state !== 'available' || saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/social/handle', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: normalizeHandle(value) }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (body.code === 'too_soon' && body.until) setLockedUntil(body.until)
        if (body.code === 'taken') setState('taken')
        setError(socialErrorText(t, body))
        return
      }
      haptic(10)
      setEditing(false)
      onChanged(body.identity)
    } catch {
      setError(t('social.inbox.actionFailed'))
    } finally {
      setSaving(false)
    }
  }

  const until = lockedUntil ? new Date(lockedUntil).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' }) : null
  const hint = until ? t('social.privacy.handleAgain', { date: until }) : t('social.privacy.handleRule')
  const status = {
    idle: t('social.setup.handleHint'),
    same: t('social.setup.handleHint'),
    checking: t('social.setup.checking'),
    available: t('social.setup.available'),
    taken: t('social.setup.taken'),
    invalid: t('social.setup.invalid'),
    reserved: t('social.setup.reserved'),
  }[state]
  const bad = state === 'taken' || state === 'invalid' || state === 'reserved'

  if (!editing) {
    return (
      <StackedRow
        label={t('social.setup.handle')}
        hint={hint}
        end={!until && <Button variant="ghost" size="sm" className="-my-2 h-11 px-4 [@media(pointer:fine)]:h-9" onClick={() => { setValue(handle); setEditing(true) }}>{t('social.privacy.change')}</Button>}
      >
        <bdi dir="ltr" className="text-[15px] text-white/80">@{handle}</bdi>
      </StackedRow>
    )
  }
  return (
    <form onSubmit={save} className="py-4" noValidate>
      <label htmlFor={`${id}-handle`} className="text-[15px] font-medium text-white">{t('social.setup.handle')}</label>
      <p className="mt-0.5 text-[13px] text-white/55">{hint}</p>
      <div className="relative mt-3" dir="ltr">
        <AtSign aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45" />
        <input
          id={`${id}-handle`}
          value={value}
          onChange={(event) => setValue(event.target.value.toLowerCase().replace(/\s+/g, ''))}
          autoFocus
          dir="ltr"
          maxLength={21}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-status`}
          aria-invalid={bad || undefined}
          className={cn(FIELD, 'pl-10', bad && 'border-red-500/60')}
        />
      </div>
      <p id={`${id}-status`} aria-live="polite" className={cn('mt-1.5 text-[13px]', bad ? 'text-red-400' : state === 'available' ? 'text-white/80' : 'text-white/55')}>{status}</p>
      {error && <p role="alert" className="mt-1.5 text-[13px] text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2.5">
        <Button type="submit" className="h-11 px-5" disabled={state !== 'available' || saving}>{t('social.privacy.save')}</Button>
        <Button type="button" variant="ghost" className="h-11 px-5" onClick={() => { setEditing(false); setError(null) }}>{t('common.cancel')}</Button>
      </div>
    </form>
  )
}

function LoadingRows() {
  return (
    <SettingsGroup aria-busy>
      {[0, 1, 2].map((row) => (
        <div key={row} className="space-y-2.5 py-4">
          <Skeleton className="h-4 w-1/3 rounded-full" />
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      ))}
    </SettingsGroup>
  )
}

export default function SocialPrivacySettings(): JSX.Element | null {
  const { t } = useI18n()
  const router = useRouter()
  const ids = useId()
  const { status, self, reload } = useSocialSelf()
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<Blocked[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [usePhoto, setUsePhoto] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pastShared, setPastShared] = useState(false)
  const [confirm, setConfirm] = useState<'sharePast' | 'reset' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedField, flashSaved] = useSavedFlash()
  const scrolled = useRef(false)
  const [host, setHost] = useState('')
  useEffect(() => setHost(window.location.host), [])
  const handle = status === 'ready' ? self?.handle ?? null : null

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const [privacyResponse, friendsResponse] = await Promise.all([
        fetch('/api/social/privacy', { cache: 'no-store' }),
        fetch('/api/social/friends', { cache: 'no-store' }),
      ])
      if (!privacyResponse.ok || !friendsResponse.ok) throw new Error('load')
      const [privacyBody, friendsBody] = await Promise.all([privacyResponse.json(), friendsResponse.json()])
      setPrivacy(privacyBody.privacy ?? DEFAULT_PRIVACY)
      setShareUrl(privacyBody.shareUrl ?? null)
      setBlocked(Array.isArray(friendsBody.blocked) ? friendsBody.blocked : [])
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    if (handle) void load()
  }, [handle, load])

  useEffect(() => {
    if (!self) return
    setName(self.name)
    setBio(self.bio)
    setUsePhoto(self.usePhoto)
  }, [self])

  // Arriving at /profile#privacy: the section grows once its data is in, so bring it into view then.
  useEffect(() => {
    const ready = status === 'ready' && (!handle || !!privacy)
    if (!ready || scrolled.current || window.location.hash !== '#privacy') return
    scrolled.current = true
    requestAnimationFrame(() => document.getElementById('privacy')?.scrollIntoView({ block: 'start' }))
  }, [status, handle, privacy])

  if (status === 'guest' || status === 'kids' || status === 'needs_pick') return null

  const savePrivacy = async (patch: Partial<PrivacySettings> & { sharePastRatings?: boolean; resetShareKey?: boolean }) => {
    const before = privacy
    if (privacy) setPrivacy({ ...privacy, ...Object.fromEntries(Object.entries(patch).filter(([key]) => key in privacy)) } as PrivacySettings)
    try {
      const response = await fetch('/api/social/privacy', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw body
      setPrivacy(body.privacy)
      setShareUrl(body.shareUrl ?? null)
      return true
    } catch (error) {
      setPrivacy(before)
      toast({ variant: 'destructive', title: error && typeof error === 'object' && 'code' in error ? socialErrorText(t, error as { code?: string }) : t('social.inbox.actionFailed') })
      return false
    }
  }

  const savePage = async (field: 'name' | 'bio' | 'usePhoto', value: string | boolean, revert: () => void) => {
    try {
      const response = await fetch('/api/social/handle', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw body
      invalidateSocialSelf()
      flashSaved(field)
      router.refresh()
    } catch (error) {
      revert()
      const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : null
      toast({ variant: 'destructive', title: code === 'invalid_name' ? t('social.setup.nameInvalid') : code ? socialErrorText(t, { code }) : t('social.inbox.actionFailed') })
    }
  }

  const commitName = () => {
    const next = name.trim()
    if (!self || next === self.name) return setName(self?.name ?? '')
    if (!next) return setName(self.name)
    void savePage('name', next, () => setName(self.name))
  }
  const commitBio = () => {
    if (!self || bio.trim() === self.bio) return
    void savePage('bio', bio.trim(), () => setBio(self.bio))
  }

  const copyLink = async () => {
    if (!shareUrl) return
    const url = new URL(shareUrl, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(url)
      haptic(8)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
    }
  }

  const unblock = async (entry: Blocked) => {
    const before = blocked
    setBlocked((current) => current?.filter((row) => row.id !== entry.id) ?? null)
    try {
      const response = await fetch(`/api/social/friends?unblock=${encodeURIComponent(entry.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(String(response.status))
    } catch {
      setBlocked(before)
      toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
    }
  }

  const runConfirm = async () => {
    if (!confirm || busy) return
    setBusy(true)
    try {
      if (confirm === 'sharePast') {
        if (await savePrivacy({ sharePastRatings: true })) setPastShared(true)
      } else if (confirm === 'reset') {
        await savePrivacy({ resetShareKey: true })
      } else {
        const response = await fetch('/api/social/handle', { method: 'DELETE' })
        if (!response.ok) throw new Error(String(response.status))
        invalidateSocialSelf()
        setPrivacy(null)
        setBlocked(null)
        await reload()
        router.refresh()
      }
      setConfirm(null)
    } catch {
      toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
    } finally {
      setBusy(false)
    }
  }

  const section = (children: React.ReactNode) => (
    <SettingsSection id="privacy" title={t('social.privacy.title')} description={t('social.privacy.desc')}>{children}</SettingsSection>
  )

  if (status === 'loading') return section(<LoadingRows />)
  if (status === 'tv') return section(<p className="text-[14px] text-white/60">{t('social.errors.tv_session')}</p>)
  if (status === 'error' || !self) {
    return section(
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-white/60">{t('social.privacy.loadFailed')}</p>
        <Button variant="secondary" className="h-11" onClick={() => void reload()}><RotateCw aria-hidden className="h-4 w-4" />{t('social.inbox.retry')}</Button>
      </div>,
    )
  }
  if (!self.handle) return section(<ProfileSetupCard variant="inline" onCreated={() => { void reload(); router.refresh() }} />)

  if (failed) {
    return section(
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-white/60">{t('social.privacy.loadFailed')}</p>
        <Button variant="secondary" className="h-11" onClick={() => void load()}><RotateCw aria-hidden className="h-4 w-4" />{t('social.inbox.retry')}</Button>
      </div>,
    )
  }
  if (!privacy) return section(<LoadingRows />)

  const fullLink = shareUrl ? `${host}${shareUrl}` : ''

  return section(
    <div className="space-y-8">
      {/* Your page */}
      <div>
        <GroupHeading icon={<UserRound />}>{t('social.menu.yourPage')}</GroupHeading>
        <SettingsGroup>
          <HandleRow handle={self.handle} changeAt={self.handleChangeAt} onChanged={() => { invalidateSocialSelf(); void reload(); void load(); router.refresh() }} />
          <StackedRow label={t('social.setup.name')} labelFor={`${ids}-name`} end={<SavedMark show={savedField === 'name'} />}>
            <input
              id={`${ids}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }}
              maxLength={NAME_MAX}
              dir="auto"
              autoComplete="nickname"
              className={FIELD}
            />
          </StackedRow>
          <StackedRow
            label={t('social.setup.bio')}
            labelFor={`${ids}-bio`}
            end={savedField === 'bio' ? <SavedMark show /> : <span aria-hidden className="text-[12px] tabular-nums text-white/50">{t('social.setup.charsLeft', { count: BIO_MAX - bio.length })}</span>}
          >
            <Textarea
              id={`${ids}-bio`}
              value={bio}
              onChange={(event) => setBio(event.target.value.slice(0, BIO_MAX))}
              onBlur={commitBio}
              maxLength={BIO_MAX}
              dir="auto"
              rows={2}
              placeholder={t('social.setup.bioPlaceholder')}
              className="min-h-[72px] resize-none py-2.5 text-[16px]"
            />
          </StackedRow>
          {self.owner && self.hasPhoto && (
            <SwitchRow
              id={`${ids}-photo`}
              checked={usePhoto}
              onCheckedChange={(value) => { setUsePhoto(value); void savePage('usePhoto', value, () => setUsePhoto(!value)) }}
              label={t('social.setup.usePhoto')}
              hint={t('social.setup.usePhotoHint')}
            />
          )}
        </SettingsGroup>
      </div>

      {/* Who sees what */}
      <div>
        <GroupHeading icon={<EyeOff />}>{t('social.privacy.who')}</GroupHeading>
        <SettingsGroup>
          <StackedRow label={t('social.privacy.activity')} hint={t('social.privacy.activityHint')}>
            <VisibilitySelect
              value={privacy.activity}
              onChange={(value) => void savePrivacy({ activity: value === 'friends' ? 'friends' : 'private' })}
              label={t('social.privacy.activity')}
              context="profile"
              options={['private', 'friends']}
            />
          </StackedRow>
          <StackedRow label={t('social.privacy.ratings')} hint={t('social.privacy.ratingsHint')}>
            <VisibilitySelect value={privacy.ratings} onChange={(value: Visibility) => { setPastShared(false); void savePrivacy({ ratings: value }) }} label={t('social.privacy.ratings')} context="profile" />
            {privacy.ratings !== 'private' && (
              pastShared ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] text-white/65"><Check aria-hidden className="h-4 w-4" />{t('social.privacy.sharedPast')}</p>
              ) : (
                <Button variant="ghost" className="-ms-3 mt-2 h-11 px-3 text-[14px] text-white/80" onClick={() => setConfirm('sharePast')}>{t('social.privacy.sharePast')}</Button>
              )
            )}
          </StackedRow>
          <StackedRow label={t('social.privacy.badges')}>
            <VisibilitySelect value={privacy.badges} onChange={(value: Visibility) => void savePrivacy({ badges: value })} label={t('social.privacy.badges')} context="profile" />
          </StackedRow>
          <BadgesSetting />
          <StackedRow label={t('social.privacy.link')} hint={t('social.privacy.linkHint')}>
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.04] py-1 pe-1 ps-3.5 ring-1 ring-inset ring-white/[0.07]">
              <Link2 aria-hidden className="h-4 w-4 shrink-0 text-white/45" />
              <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[13.5px] text-white/70">{fullLink}</span>
              <Button variant="secondary" size="sm" className="h-10 shrink-0 px-4" onClick={() => void copyLink()} aria-live="polite">
                {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
                {copied ? t('social.privacy.copied') : t('social.privacy.copy')}
              </Button>
            </div>
            <Button variant="ghost" className="-ms-3 mt-2 h-11 px-3 text-[14px] text-white/75" onClick={() => setConfirm('reset')}>
              <RotateCw aria-hidden className="h-4 w-4" />{t('social.privacy.reset')}
            </Button>
          </StackedRow>
          <StackedRow label={t('social.privacy.requests')} hint={privacy.requests === 'nobody' ? t('social.privacy.requestsHint') : undefined}>
            <RadioList
              label={t('social.privacy.requests')}
              value={privacy.requests}
              onChange={(value) => void savePrivacy({ requests: value })}
              options={[
                { value: 'anyone', label: t('social.privacy.requestsAnyone') },
                { value: 'nobody', label: t('social.privacy.requestsNobody') },
              ]}
            />
          </StackedRow>
          <SwitchRow
            id={`${ids}-pause`}
            checked={privacy.paused}
            onCheckedChange={(value) => void savePrivacy({ paused: value })}
            label={t('social.privacy.pause')}
            hint={t('social.privacy.pauseHint')}
          />
        </SettingsGroup>
      </div>

      {/* Blocked people */}
      <div>
        <GroupHeading icon={<ShieldOff />}>{t('social.privacy.blocked')}</GroupHeading>
        <SettingsGroup>
          {!blocked || blocked.length === 0 ? (
            <p className="py-4 text-[14px] text-white/55">{t('social.privacy.noBlocked')}</p>
          ) : blocked.map((entry) => {
            const who = entry.person ?? { name: t('social.inbox.someone'), color: '#3f3f46', handle: null }
            return (
              <div key={entry.id} className="flex items-center gap-3 py-3">
                <UserAvatar person={who} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-white"><bdi>{who.name}</bdi></span>
                  {who.handle && <span className="block truncate text-[13px] text-white/55"><bdi dir="ltr">@{who.handle}</bdi></span>}
                </span>
                <Button variant="ghost" size="sm" className="h-11 shrink-0 px-4 ring-1 ring-inset ring-white/[0.12] [@media(pointer:fine)]:h-9" onClick={() => void unblock(entry)} aria-label={t('social.privacy.unblockName', { name: who.name })}>
                  {t('social.privacy.unblock')}
                </Button>
              </div>
            )
          })}
        </SettingsGroup>
      </div>

      {/* Danger zone */}
      <div className="flex flex-col gap-4 rounded-2xl p-4 ring-1 ring-inset ring-red-500/20 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-white">{t('social.privacy.delete')}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/55">{t('social.privacy.deleteHint')}</p>
        </div>
        <Button variant="destructive" className="h-11 shrink-0 px-5" onClick={() => setConfirm('delete')}>
          <Trash2 aria-hidden className="h-4 w-4" />{t('social.privacy.delete')}
        </Button>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        title={t(confirm === 'sharePast' ? 'social.privacy.sharePastTitle' : confirm === 'reset' ? 'social.privacy.resetTitle' : 'social.privacy.deleteTitle')}
        text={t(confirm === 'sharePast' ? 'social.privacy.sharePastText' : confirm === 'reset' ? 'social.privacy.resetText' : 'social.privacy.deleteText')}
        confirm={t(confirm === 'sharePast' ? 'social.privacy.sharePastConfirm' : confirm === 'reset' ? 'social.privacy.resetConfirm' : 'social.privacy.delete')}
        tone={confirm === 'sharePast' ? 'default' : 'destructive'}
        onConfirm={() => void runConfirm()}
        busy={busy}
      />
    </div>,
  )
}
