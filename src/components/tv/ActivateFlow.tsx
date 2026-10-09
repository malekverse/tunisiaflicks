"use client"
// /activate on the phone, in two steps:
// 1. The code: typed, or filled in from the TV's QR code. Shown back large with "Is this the code on
//    your TV right now?", the kind of device and how long ago it asked. [Yes, that's my TV] or
//    [This isn't my TV] (which cancels the code for everyone).
// 2. The profile the TV will use, then [Sign in on the TV]. A sign-in older than 10 minutes on this
//    phone is confirmed first: the password, or Google with prompt=login (back here after).
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { FcGoogle } from 'react-icons/fc'
import { Check, CircleCheck, ShieldAlert, ShieldCheck, Tv, X } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar'
import type { Profile } from '@/src/lib/models/Profile'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { BrandLoader } from '@/src/components/brand/BrandMark'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const clean = (value: string) => value.toUpperCase().split('').filter((char) => ALPHABET.includes(char)).join('').slice(0, 6)

type Found = { code: string; deviceLabel: string; requestedMinutesAgo: number }
type Step =
  | { kind: 'enter' }
  | { kind: 'confirm'; found: Found }
  | { kind: 'profile'; found: Found }
  | { kind: 'done'; name: string }
  | { kind: 'denied' }

const ERRORS: Record<string, TKey> = {
  not_found: 'tvMode.activate.notFound',
  burned: 'tvMode.activate.burned',
  expired: 'tvMode.activate.expired',
  tooMany: 'tvMode.activate.tooMany',
  failed: 'tvMode.activate.failed',
}

export default function ActivateFlow({ initialCode, profiles, activeProfileId, fresh, email, hasPassword, google }: {
  initialCode: string
  profiles: Profile[]
  activeProfileId: string
  fresh: boolean
  email: string
  hasPassword: boolean
  google: boolean
}) {
  const t = useT()
  const [code, setCode] = useState(initialCode)
  const [step, setStep] = useState<Step>({ kind: 'enter' })
  const [error, setError] = useState<TKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [profileId, setProfileId] = useState(activeProfileId)
  const [needsReauth, setNeedsReauth] = useState(!fresh)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Each step announces itself to screen readers by taking the focus on its heading.
  useEffect(() => {
    if (step.kind !== 'enter') headingRef.current?.focus({ preventScroll: true })
  }, [step.kind])

  const lookup = useCallback(async (value: string) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/tv/pair/lookup?code=${encodeURIComponent(value)}`, { cache: 'no-store' })
      if (response.status === 401) return window.location.reload()
      if (response.status === 429) return setError(ERRORS.tooMany)
      const body = await response.json().catch(() => ({}))
      if (response.ok) return setStep({ kind: 'confirm', found: body as Found })
      if (body.code === 'needs_pick') return window.location.reload()
      setError(ERRORS[body.code] ?? ERRORS.failed)
    } catch {
      setError(ERRORS.failed)
    } finally {
      setBusy(false)
    }
  }, [])

  // A code from the TV's QR code: look it up at once (asking is still up to the person).
  const started = useRef(false)
  useEffect(() => {
    if (started.current || clean(initialCode).length !== 6) return
    started.current = true
    lookup(clean(initialCode))
  }, [initialCode, lookup])

  const answer = async (approve: boolean, found: Found) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/tv/pair/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: found.code, approve, profileId }),
      })
      if (response.status === 429) return setError(ERRORS.tooMany)
      const body = await response.json().catch(() => ({}))
      if (response.ok) {
        if (!approve) return setStep({ kind: 'denied' })
        return setStep({ kind: 'done', name: body.profile?.name ?? '' })
      }
      if (body.code === 'reauth') return setNeedsReauth(true)
      setError(ERRORS[body.code] ?? ERRORS.failed)
    } catch {
      setError(ERRORS.failed)
    } finally {
      setBusy(false)
    }
  }

  const confirmPassword = async (event: React.FormEvent, found: Found) => {
    event.preventDefault()
    if (!password) return
    setBusy(true)
    setPasswordError(false)
    const result = await signIn('credentials', { email, password, redirect: false }).catch(() => null)
    setBusy(false)
    if (!result?.ok) {
      if (result?.error === 'TooManyAttempts') setError(ERRORS.tooMany)
      else setPasswordError(true)
      return
    }
    setPassword('')
    setNeedsReauth(false)
    await answer(true, found)
  }

  const reauthWithGoogle = (found: Found) => {
    setBusy(true)
    signIn('google', { callbackUrl: `/activate?code=${found.code}` }, { prompt: 'login' })
  }

  const restart = () => {
    setCode('')
    setError(null)
    setStep({ kind: 'enter' })
  }

  const requested = (minutes: number) =>
    minutes < 1 ? t('tvMode.activate.requestedNow')
      : minutes === 1 ? t('tvMode.activate.requestedOne')
        : minutes === 2 ? t('tvMode.activate.requestedTwo')
          : t('tvMode.activate.requestedMany', { n: minutes })

  const stepNumber = step.kind === 'profile' ? 2 : step.kind === 'enter' || step.kind === 'confirm' ? 1 : null

  const bigCode = (value: string) => (
    <p dir="ltr" className="flex justify-center gap-[0.45em] font-display text-[clamp(44px,13vw,64px)] font-extrabold leading-none tracking-[0.08em] text-white tabular-nums">
      <span>{value.slice(0, 3)}</span>
      <span>{value.slice(3)}</span>
    </p>
  )

  const errorLine = error && <p role="alert" className="mt-3 text-[13px] text-red-400">{t(error)}</p>

  return (
    <div className="page-top page-x pb-14">
      <div className="mx-auto w-full max-w-[30rem]">
        <header className="pt-4 text-center sm:pt-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-white/[0.07] ring-1 ring-inset ring-white/10">
            <Tv aria-hidden className="h-7 w-7 text-white" strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[clamp(32px,7vw,48px)] font-extrabold leading-[0.98] text-white">{t('tvMode.activate.title')}</h1>
          <p className="mx-auto mt-3 max-w-[40ch] text-[15px] leading-relaxed text-white/60">{t('tvMode.activate.subtitle')}</p>
        </header>

        {stepNumber && <p className="mt-8 text-center text-[13px] font-medium text-white/50">{t('tvMode.activate.step', { n: stepNumber })}</p>}

        <section className={cn('rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6', stepNumber ? 'mt-3' : 'mt-8')}>
          {step.kind === 'enter' && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (clean(code).length === 6) lookup(clean(code))
              }}
            >
              <label htmlFor="tv-code" className="block text-[13px] font-medium text-white/70">{t('tvMode.activate.codeLabel')}</label>
              <Input
                id="tv-code"
                dir="ltr"
                value={code}
                onChange={(event) => setCode(clean(event.target.value))}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                maxLength={6}
                placeholder="ABC234"
                aria-describedby="tv-code-hint"
                aria-invalid={!!error || undefined}
                className="mt-2 h-16 text-center font-display text-[32px] font-bold uppercase tracking-[0.3em] placeholder:tracking-[0.3em] placeholder:text-white/25"
              />
              <p id="tv-code-hint" className="mt-2 text-[13px] text-white/50">{t('tvMode.activate.codeHint')}</p>
              {errorLine}
              <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || clean(code).length !== 6}>
                {busy && <BrandLoader className="h-4 w-4" />}
                {t('tvMode.activate.continue')}
              </Button>
            </form>
          )}

          {step.kind === 'confirm' && (
            <div className="text-center">
              <h2 ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold text-white outline-none">{t('tvMode.activate.question')}</h2>
              <div className="mt-5">{bigCode(step.found.code)}</div>
              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13.5px] text-white/60">
                <span className="inline-flex items-center gap-1.5 text-white/80">
                  <Tv aria-hidden className="h-4 w-4" />
                  {t(`tvMode.device.${step.found.deviceLabel}` as TKey)}
                </span>
                <span>{requested(step.found.requestedMinutesAgo)}</span>
              </p>
              {errorLine}
              <div className="mt-6 grid gap-2.5">
                <Button size="lg" disabled={busy} onClick={() => setStep({ kind: 'profile', found: step.found })}>
                  <Check aria-hidden className="h-[18px] w-[18px]" />
                  {t('tvMode.activate.yes')}
                </Button>
                <Button size="lg" variant="secondary" disabled={busy} onClick={() => answer(false, step.found)}>
                  <X aria-hidden className="h-[18px] w-[18px]" />
                  {t('tvMode.activate.no')}
                </Button>
              </div>
            </div>
          )}

          {step.kind === 'profile' && (
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold text-white outline-none">{t('tvMode.activate.whoTitle')}</h2>
              <div role="radiogroup" aria-label={t('tvMode.activate.whoTitle')} className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {profiles.map((profile) => {
                  const selected = profile.id === profileId
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setProfileId(profile.id)}
                      className={cn(
                        'pressable relative flex min-h-[64px] items-center gap-3 rounded-2xl px-3 py-2.5 text-start outline-none ring-1 ring-inset transition-[background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-red-500',
                        selected ? 'bg-white/[0.1] ring-white/70' : 'bg-white/[0.04] ring-white/[0.08] hover:bg-white/[0.07]',
                      )}
                    >
                      <ProfileAvatar profile={profile} size="md" />
                      <span className="min-w-0 flex-1">
                        <bdi className="block truncate text-[14.5px] font-medium text-white">{profile.name}</bdi>
                        {profile.kids && <KidsBadge label={t('profiles.kidsBadge')} className="mt-1 inline-block" />}
                      </span>
                      {selected && <Check aria-hidden className="h-4 w-4 shrink-0 text-white" />}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-[13px] leading-snug text-white/55">{t('tvMode.activate.whoHint')}</p>

              {needsReauth ? (
                <div className="mt-6 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.07]">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
                    <ShieldCheck aria-hidden className="h-[18px] w-[18px] text-white/70" />
                    {t('tvMode.activate.reauthTitle')}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-white/60">{hasPassword ? t('tvMode.activate.reauthText') : t('tvMode.activate.reauthGoogle')}</p>
                  {hasPassword && (
                    <form onSubmit={(event) => confirmPassword(event, step.found)} className="mt-4">
                      <label htmlFor="tv-password" className="block text-[13px] font-medium text-white/70">{t('auth.password')}</label>
                      <Input
                        id="tv-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        aria-invalid={passwordError || undefined}
                        className="mt-2"
                      />
                      {passwordError && <p role="alert" className="mt-2 text-[13px] text-red-400">{t('tvMode.activate.wrongPassword')}</p>}
                      <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy || !password}>
                        {busy && <BrandLoader className="h-4 w-4" />}
                        {t('tvMode.activate.confirm')}
                      </Button>
                    </form>
                  )}
                  {google && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => reauthWithGoogle(step.found)}
                      className="pressable mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white/[0.07] px-5 text-[15px] font-medium text-white outline-none ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.11] focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <FcGoogle aria-hidden className="h-5 w-5" />
                      {t('auth.continueWithGoogle')}
                    </button>
                  )}
                  {errorLine}
                </div>
              ) : (
                <>
                  {errorLine}
                  <Button size="lg" className="mt-6 w-full" disabled={busy} onClick={() => answer(true, step.found)}>
                    {busy ? <BrandLoader className="h-4 w-4" /> : <Tv aria-hidden className="h-[18px] w-[18px]" />}
                    {t('tvMode.activate.approve')}
                  </Button>
                </>
              )}
            </div>
          )}

          {step.kind === 'done' && (
            <div className="py-2 text-center">
              <CircleCheck aria-hidden className="mx-auto h-12 w-12 text-emerald-400" strokeWidth={1.6} />
              <h2 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-[26px] font-bold text-white outline-none">{t('tvMode.activate.doneTitle')}</h2>
              <p className="mx-auto mt-2 max-w-[36ch] text-[14.5px] leading-relaxed text-white/65">{t('tvMode.activate.doneText', { name: step.name })}</p>
              <Button asChild variant="secondary" className="mt-6">
                <Link href="/profile#security">{t('tvMode.activate.manage')}</Link>
              </Button>
            </div>
          )}

          {step.kind === 'denied' && (
            <div className="py-2 text-center">
              <ShieldAlert aria-hidden className="mx-auto h-12 w-12 text-white/80" strokeWidth={1.6} />
              <h2 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-[26px] font-bold text-white outline-none">{t('tvMode.activate.deniedTitle')}</h2>
              <p className="mx-auto mt-2 max-w-[36ch] text-[14.5px] leading-relaxed text-white/65">{t('tvMode.activate.deniedText')}</p>
              <Button variant="secondary" className="mt-6" onClick={restart}>{t('tvMode.activate.another')}</Button>
            </div>
          )}
        </section>

        {(step.kind === 'enter' || step.kind === 'confirm') && (
          <p className="mt-5 flex items-start gap-2.5 px-1 text-[13.5px] leading-relaxed text-white/60">
            <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            {t('tvMode.activate.warning')}
          </p>
        )}
      </div>
    </div>
  )
}
