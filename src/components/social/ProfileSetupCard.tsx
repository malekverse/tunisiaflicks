"use client"
// "Create your page": a handle (checked as you type), a name, a few words about you and, on the
// account owner's profile, the account photo. Nothing is shared until the person turns it on.
// Used on /me, /friends, Settings, inside the ShareSheet and inside invitation banners.
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { AtSign, Check, Lock, MailCheck } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'
import { Button } from '@/src/components/ui/button'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import { Skeleton } from '@/src/components/ui/skeleton'
import { SwitchRow } from '@/src/components/ui/switch'
import { Textarea } from '@/src/components/ui/textarea'
import { haptic, spring, tween } from '@/src/lib/motion'
import { BIO_MAX, NAME_MAX, checkHandle, normalizeHandle } from '@/src/lib/social/rules'
import type { PublicIdentity } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'
import { UserAvatar } from './Avatar'
import { invalidateSocialSelf, socialErrorText, useSocialSelf } from './use-social-self'

type HandleCheck = { state: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved'; suggestions: string[] }

const DEBOUNCE_MS = 350

export default function ProfileSetupCard({ onCreated, variant = 'page' }: { onCreated?: (identity: PublicIdentity) => void; variant?: 'page' | 'inline' }): JSX.Element {
  const t = useT()
  const router = useRouter()
  const ids = useId()
  const { status, self, reload } = useSocialSelf()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [usePhoto, setUsePhoto] = useState(false)
  const [check, setCheck] = useState<HandleCheck>({ state: 'idle', suggestions: [] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)
  const [created, setCreated] = useState<PublicIdentity | null>(null)
  const [unverified, setUnverified] = useState(false)
  const seeded = useRef(false)
  const request = useRef(0)
  const inline = variant === 'inline'
  const still = useReducedMotion()

  // Prefill the name once we know the profile's.
  useEffect(() => {
    if (status === 'ready' && self && !seeded.current) {
      seeded.current = true
      setName(self.name)
    }
  }, [status, self])

  // The handle is checked 350ms after typing stops; malformed ones never reach the server.
  useEffect(() => {
    const value = normalizeHandle(handle) ?? ''
    const attempt = ++request.current
    if (!value) return setCheck({ state: 'idle', suggestions: [] })
    const problem = checkHandle(value)
    if (problem === 'invalid' && value.length < 3) return setCheck({ state: 'idle', suggestions: [] })
    setCheck((current) => ({ state: 'checking', suggestions: current.suggestions }))
    const timer = setTimeout(async () => {
      if (problem === 'invalid') {
        if (attempt === request.current) setCheck({ state: 'invalid', suggestions: [] })
        return
      }
      try {
        const response = await fetch(`/api/social/handle?h=${encodeURIComponent(value)}`, { cache: 'no-store' })
        const body = await response.json().catch(() => ({}))
        if (attempt !== request.current) return
        if (!response.ok) {
          setCheck({ state: 'idle', suggestions: [] })
          setError(socialErrorText(t, body))
          return
        }
        setError(null)
        setCheck({ state: body.available ? 'available' : (body.reason ?? 'taken'), suggestions: Array.isArray(body.suggestions) ? body.suggestions : [] })
      } catch {
        if (attempt === request.current) setCheck({ state: 'idle', suggestions: [] })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [handle, t])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (check.state !== 'available' || submitting) return
    setSubmitting(true)
    setError(null)
    setNameError(false)
    try {
      const response = await fetch('/api/social/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: normalizeHandle(handle), name, bio, usePhoto: usePhoto && !!self?.owner && !!self?.hasPhoto }),
      })
      const body = await response.json().catch(() => ({}))
      const finish = (identity: PublicIdentity) => {
        haptic(12)
        invalidateSocialSelf()
        setCreated(identity)
        // Let the moment land, then hand over.
        setTimeout(() => {
          if (onCreated) onCreated(identity)
          else router.refresh()
        }, 900)
      }
      if (response.status === 201 && body.identity) return finish(body.identity)
      if (body.code === 'has_handle') {
        // The page was made meanwhile (another tab, another device): carry on with that one, so
        // an invitation waiting on it goes through instead of showing this form again.
        const mine = await fetch('/api/social/handle', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        if (mine?.identity) return finish(mine.identity)
        invalidateSocialSelf()
        reload()
        router.refresh()
        return
      }
      if (body.code === 'unverified') setUnverified(true)
      else if (body.code === 'taken') setCheck({ state: 'taken', suggestions: [] })
      else if (body.code === 'invalid_name') setNameError(true)
      else setError(body.code ? socialErrorText(t, body) : t('social.setup.failed'))
    } catch {
      setError(t('social.setup.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const frame = cn(
    'relative overflow-hidden',
    inline ? 'rounded-2xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/[0.06]' : 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6',
  )

  if (status === 'loading') {
    return (
      <div aria-busy className={frame}>
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="mt-3 h-4 w-3/4 rounded-full" />
        <Skeleton className="mt-6 h-11 w-full rounded-xl" />
      </div>
    )
  }
  if (status !== 'ready' || !self) return <></>

  const preview = { name: name.trim() || self.name || '?', color: self.color ?? '#dc2626', image: null }
  const titleSize = inline ? 'text-[19px]' : 'text-[clamp(24px,2.6vw,30px)]'

  if (created) {
    return (
      <div className={cn(frame, 'flex items-center gap-4')} role="status">
        <m.span
          // The page comes into focus; with less motion it only fades in.
          initial={still ? { opacity: 0 } : { scale: 0.92, filter: 'blur(6px)', opacity: 0 }}
          animate={still ? { opacity: 1 } : { scale: 1, filter: 'blur(0px)', opacity: 1 }}
          transition={still ? tween.base : spring.ui}
          className="shrink-0"
        >
          <UserAvatar person={created} size={inline ? 56 : 96} />
        </m.span>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { ...tween.base, delay: 0.08 } }} className="min-w-0">
          <p className={cn('font-display font-extrabold leading-tight', titleSize)}>{t('social.setup.created')}</p>
          <p className="mt-1 truncate text-[15px] text-white/70"><bdi dir="ltr">@{created.handle}</bdi></p>
        </m.div>
      </div>
    )
  }

  if (!self.verified || unverified) {
    return (
      <div className={frame}>
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><MailCheck aria-hidden className="h-5 w-5 text-white/80" /></span>
          <div className="min-w-0 flex-1">
            <p className={cn('font-display font-bold leading-tight', inline ? 'text-[17px]' : 'text-[22px]')}>{t('social.setup.verifyTitle')}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-white/65">{t('social.setup.verifyText')}</p>
            <div className="mt-3 text-[14px] text-white/80"><ResendVerificationButton compact /></div>
          </div>
        </div>
      </div>
    )
  }

  const handleId = `${ids}-handle`
  const statusId = `${ids}-status`
  const value = normalizeHandle(handle) ?? ''
  const statusText = {
    idle: t('social.setup.handleHint'),
    checking: t('social.setup.checking'),
    available: t('social.setup.available'),
    taken: t('social.setup.taken'),
    invalid: t('social.setup.invalid'),
    reserved: t('social.setup.reserved'),
  }[check.state]
  const bad = check.state === 'taken' || check.state === 'invalid' || check.state === 'reserved'

  return (
    <form onSubmit={submit} className={frame} noValidate>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className={cn('font-display font-extrabold leading-tight', titleSize)}>{t('social.setup.title')}</p>
          <p className="mt-1.5 max-w-[52ch] text-[14px] leading-relaxed text-white/65">{t('social.setup.text')}</p>
        </div>
        <UserAvatar person={preview} size={inline ? 40 : 56} className="mt-0.5 ring-1 ring-white/10" />
      </div>

      <div className={cn('grid gap-4', inline ? 'mt-4' : 'mt-6 sm:grid-cols-2')}>
        <div className="sm:col-span-2">
          <label htmlFor={handleId} className="mb-1.5 block text-[13px] text-white/70">{t('social.setup.handle')}</label>
          <div className="relative" dir="ltr">
            <AtSign aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45" />
            <input
              id={handleId}
              value={handle}
              onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/\s+/g, ''))}
              dir="ltr"
              maxLength={21}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-describedby={statusId}
              aria-invalid={bad || undefined}
              className={cn(
                'h-11 w-full rounded-xl border bg-white/[0.05] pl-10 pr-10 text-[16px] text-white outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-white/40 hover:border-white/20 focus-visible:bg-white/[0.07] focus-visible:ring-4',
                bad ? 'border-red-500/60 focus-visible:ring-red-500/15' : 'border-white/10 focus-visible:border-red-500/70 focus-visible:ring-red-500/15',
              )}
              placeholder="your_name"
            />
            <AnimatePresence>
              {check.state === 'available' && (
                <m.span
                  key="ok"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={spring.snappy}
                  // Motion owns this transform (the scale), so the centring goes through it too.
                  style={{ y: '-50%' }}
                  className="absolute right-3 top-1/2 grid h-6 w-6 place-items-center rounded-full bg-white text-black"
                >
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
                </m.span>
              )}
            </AnimatePresence>
          </div>
          <p id={statusId} aria-live="polite" className={cn('mt-1.5 text-[13px]', bad ? 'text-red-400' : check.state === 'available' ? 'text-white/80' : 'text-white/55')}>
            {check.state === 'available' ? <><bdi dir="ltr">@{value}</bdi>{' '}{statusText}</> : statusText}
          </p>
          {bad && check.suggestions.length > 0 && (
            <div className="mt-2.5">
              <p aria-hidden className="mb-2 text-[12.5px] text-white/55">{t('social.setup.suggestions')}</p>
              <ChipGroup mode="none" label={t('social.setup.suggestions')}>
                {check.suggestions.map((suggestion) => (
                  <Chip key={suggestion} onClick={() => setHandle(suggestion)}>
                    <bdi dir="ltr">@{suggestion}</bdi>
                  </Chip>
                ))}
              </ChipGroup>
            </div>
          )}
        </div>

        <div className={inline ? '' : 'sm:col-span-1'}>
          <label htmlFor={`${ids}-name`} className="mb-1.5 block text-[13px] text-white/70">{t('social.setup.name')}</label>
          <input
            id={`${ids}-name`}
            value={name}
            onChange={(event) => { setName(event.target.value); setNameError(false) }}
            maxLength={NAME_MAX}
            dir="auto"
            autoComplete="nickname"
            aria-describedby={`${ids}-name-hint`}
            aria-invalid={nameError || undefined}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[16px] text-white outline-none transition-[border-color,background-color,box-shadow] duration-200 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07] focus-visible:ring-4 focus-visible:ring-red-500/15"
          />
          <p id={`${ids}-name-hint`} className={cn('mt-1.5 text-[13px]', nameError ? 'text-red-400' : 'text-white/55')}>
            {nameError ? t('social.setup.nameInvalid') : t('social.setup.nameHint')}
          </p>
        </div>

        <div className={inline ? '' : 'sm:col-span-1'}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={`${ids}-bio`} className="text-[13px] text-white/70">{t('social.setup.bio')}</label>
            <span aria-hidden className={cn('text-[12px] tabular-nums', BIO_MAX - bio.length <= 20 ? 'text-white/70' : 'text-white/50')}>
              {t('social.setup.charsLeft', { count: BIO_MAX - bio.length })}
            </span>
          </div>
          <Textarea
            id={`${ids}-bio`}
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, BIO_MAX))}
            maxLength={BIO_MAX}
            dir="auto"
            rows={2}
            placeholder={t('social.setup.bioPlaceholder')}
            className="min-h-[44px] resize-none py-2.5 text-[16px]"
          />
        </div>

        {self.owner && self.hasPhoto && (
          <div className="sm:col-span-2 -my-1">
            <SwitchRow id={`${ids}-photo`} checked={usePhoto} onCheckedChange={setUsePhoto} label={t('social.setup.usePhoto')} hint={t('social.setup.usePhotoHint')} />
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-[13px] text-red-400">{error}</p>}

      <div className={cn('mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between', inline && 'sm:flex-col-reverse sm:items-stretch')}>
        <p className="flex items-center gap-2 text-[13px] text-white/55">
          <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {t('social.setup.footnote')}
        </p>
        <Button type="submit" size="lg" disabled={check.state !== 'available' || submitting} className={cn(inline && 'w-full')}>
          {submitting ? t('social.setup.creating') : t('social.setup.create')}
        </Button>
      </div>
    </form>
  )
}
