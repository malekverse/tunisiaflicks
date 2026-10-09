"use client"
// Signing a TV in (TV mode, signed out): the code to type on a phone, and its QR code, which opens
// /activate on the phone with the code filled in (the phone still asks "is this your TV?"). The TV
// polls until the phone answers, then signs in with the 'tv-pair' provider, lets the server put it
// on the approved profile (/api/tv/pair/complete), and reloads.
import { useCallback, useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { useInTvApp } from '@/src/hooks/use-tv-mode'
import QrCode from './QrCode'
import { BrandLoader } from '@/src/components/brand/BrandMark'

type Phase =
  | { kind: 'loading' }
  | { kind: 'waiting'; deviceCode: string; userCode: string; expiresAt: number; interval: number }
  | { kind: 'approved' }
  | { kind: 'expired' | 'denied' | 'error' | 'tooMany' | 'finishFailed' }

const pad = (n: number) => String(n).padStart(2, '0')

export default function TvSignIn({ onClose, onEmail }: { onClose: () => void; onEmail: () => void }) {
  const t = useT()
  const inApp = useInTvApp()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [now, setNow] = useState(() => Date.now())
  const [origin, setOrigin] = useState('')
  const titleId = useRef(`tv-signin-${Math.random().toString(36).slice(2)}`).current
  const newCodeRef = useRef<HTMLButtonElement>(null)
  const emailRef = useRef<HTMLButtonElement>(null)

  const start = useCallback(async () => {
    setPhase({ kind: 'loading' })
    try {
      const response = await fetch('/api/tv/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (response.status === 429) return setPhase({ kind: 'tooMany' })
      if (!response.ok) return setPhase({ kind: 'error' })
      const body = await response.json()
      setPhase({ kind: 'waiting', deviceCode: body.deviceCode, userCode: body.userCode, expiresAt: Date.parse(body.expiresAt), interval: Math.max(2, Number(body.interval) || 3) })
    } catch {
      setPhase({ kind: 'error' })
    }
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
    start()
  }, [start])

  // Back closes the screen (the focus engine sends Escape to the top layer).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // The countdown.
  useEffect(() => {
    if (phase.kind !== 'waiting') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [phase.kind])

  useEffect(() => {
    if (phase.kind === 'waiting' && now >= phase.expiresAt) setPhase({ kind: 'expired' })
  }, [now, phase])

  // Waiting for the phone.
  useEffect(() => {
    if (phase.kind !== 'waiting') return
    let stopped = false
    let timer = 0
    const finish = async (deviceCode: string) => {
      setPhase({ kind: 'approved' })
      const result = await signIn('tv-pair', { deviceCode, redirect: false }).catch(() => null)
      if (!result?.ok) return setPhase({ kind: 'finishFailed' })
      await fetch('/api/tv/pair/complete', { method: 'POST' }).catch(() => null)
      // Everything (the catalogue, the bar, the rows) depends on who's signed in: a full load.
      const here = window.location.pathname
      window.location.replace(/^\/(login|signup)(\/|$)/.test(here) ? '/' : here + window.location.search)
    }
    const poll = async () => {
      try {
        const response = await fetch(`/api/tv/pair?device=${encodeURIComponent(phase.deviceCode)}`, { cache: 'no-store' })
        const body = await response.json().catch(() => ({}))
        if (stopped) return
        if (body.status === 'approved') return finish(phase.deviceCode)
        if (body.status === 'denied') return setPhase({ kind: 'denied' })
        if (body.status === 'expired' || body.status === 'used') return setPhase({ kind: 'expired' })
      } catch { /* offline for a moment: keep waiting */ }
      if (!stopped) timer = window.setTimeout(poll, phase.interval * 1000)
    }
    timer = window.setTimeout(poll, phase.interval * 1000)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [phase])

  const exitTvMode = async () => {
    await fetch('/api/tv-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: false }) }).catch(() => null)
    window.location.replace('/')
  }

  const waiting = phase.kind === 'waiting' ? phase : null
  const left = waiting ? Math.max(0, Math.round((waiting.expiresAt - now) / 1000)) : 0
  const activateUrl = waiting && origin ? `${origin}/activate?code=${waiting.userCode}` : ''
  const host = origin.replace(/^https?:\/\//, '')
  const problem: Record<string, string> = {
    expired: t('tvMode.signin.expired'),
    denied: t('tvMode.signin.denied'),
    error: t('tvMode.signin.error'),
    tooMany: t('tvMode.signin.tooMany'),
    finishFailed: t('tvMode.signin.finishFailed'),
  }
  const failed = problem[phase.kind]

  // Focus: on the way out by email at first; on a new code once this one can't be used.
  useEffect(() => {
    const target = failed ? newCodeRef.current : emailRef.current
    if (target && !target.contains(document.activeElement)) target.focus({ preventScroll: true })
  }, [failed])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] overflow-y-auto bg-black px-[var(--tv-safe-x)] pb-[var(--tv-safe-y)] pt-[calc(var(--tv-safe-y)+12px)]"
    >
      {/* The room light, dimmed: a faint red from above. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(90%_55%_at_50%_-10%,rgb(255_36_20/0.14),transparent_70%)]" />

      <div className="relative mx-auto grid min-h-full max-w-[1400px] items-center gap-[6vw] md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0">
          <h1 id={titleId} className="font-display text-[clamp(34px,4.6vw,72px)] font-extrabold leading-[0.95] text-white">
            {t('tvMode.signin.title')}
          </h1>

          <p className="mt-[3vh] text-[17px] text-white/70">
            {t('tvMode.signin.visit', { url: host ? `${host}/activate` : '…/activate' })}
          </p>

          <div className="mt-[2vh] min-h-[6.5rem]" aria-live="polite">
            {waiting ? (
              <p dir="ltr" aria-label={t('tvMode.signin.codeAria', { code: waiting.userCode.split('').join(' ') })} className="flex items-baseline gap-[0.5em] font-display text-[6rem] font-extrabold leading-none tracking-[0.08em] text-white tabular-nums">
                <span aria-hidden>{waiting.userCode.slice(0, 3)}</span>
                <span aria-hidden>{waiting.userCode.slice(3)}</span>
              </p>
            ) : phase.kind === 'loading' || phase.kind === 'approved' ? (
              <span className="flex h-[6rem] items-center gap-3 text-[17px] text-white/70">
                <BrandLoader tone="brand" className="h-7 w-7" />
                {phase.kind === 'approved' ? t('tvMode.signin.approved') : null}
              </span>
            ) : (
              <p role="alert" className="flex h-[6rem] max-w-[34ch] items-center text-[19px] font-medium text-white">{failed}</p>
            )}
          </div>

          {waiting && (
            <div className="mt-[2.5vh] flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] text-white/60">
              <span className="inline-flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-500/70 motion-reduce:hidden" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                {t('tvMode.signin.waiting')}
              </span>
              <span className="tabular-nums">{t('tvMode.signin.expiresIn', { time: `${Math.floor(left / 60)}:${pad(left % 60)}` })}</span>
            </div>
          )}

          <div className="mt-[5vh] flex flex-wrap gap-3">
            <button
              type="button"
              ref={newCodeRef}
              onClick={start}
              data-tv-autofocus={failed ? '' : undefined}
              className="inline-flex h-[3.1em] items-center gap-2.5 rounded-full bg-white/[0.1] px-[1.3em] text-[16px] font-semibold text-white outline-none ring-1 ring-inset ring-white/15"
            >
              <RefreshCw aria-hidden className="h-[1.1em] w-[1.1em]" />
              {t('tvMode.signin.newCode')}
            </button>
            <button
              type="button"
              ref={emailRef}
              onClick={onEmail}
              data-tv-autofocus={failed ? undefined : ''}
              className="inline-flex h-[3.1em] items-center gap-2.5 rounded-full bg-white/[0.1] px-[1.3em] text-[16px] font-semibold text-white outline-none ring-1 ring-inset ring-white/15"
            >
              <Mail aria-hidden className="h-[1.1em] w-[1.1em]" />
              {t('tvMode.signin.email')}
            </button>
            {!inApp && (
              <button
                type="button"
                onClick={exitTvMode}
                className="inline-flex h-[3.1em] items-center gap-2.5 rounded-full px-[1.1em] text-[16px] font-medium text-white/70 outline-none"
              >
                <LogOut aria-hidden className="h-[1.1em] w-[1.1em] rtl:rotate-180" />
                {t('tvMode.setting.exit')}
              </button>
            )}
          </div>

          <p className="mt-[4vh] flex items-center gap-2 text-[14px] text-white/50">
            <ShieldCheck aria-hidden className="h-4 w-4 shrink-0" />
            {t('tvMode.signin.safety')}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 md:items-end">
          <div className="rounded-[26px] bg-white/[0.04] p-[clamp(14px,1.6vw,26px)] ring-1 ring-white/[0.08]">
            {activateUrl ? (
              <QrCode value={activateUrl} label={t('tvMode.signin.qrAlt')} className="h-[min(38vh,340px)] w-[min(38vh,340px)] p-3" />
            ) : (
              <div aria-hidden className="h-[min(38vh,340px)] w-[min(38vh,340px)] rounded-[14px] bg-white/[0.06]" />
            )}
          </div>
          <p className="max-w-[min(38vh,340px)] text-center text-[15px] text-white/60">{t('tvMode.signin.scan')}</p>
        </div>
      </div>
    </div>
  )
}
