"use client"
import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Info, Laptop, RotateCw, Send, Smartphone } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/src/components/ui/drawer'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { Locale } from '@/src/lib/i18n/locales'
import SegmentedRadio from './SegmentedRadio'

type Preview = { html: string; subject: string; preheader: string; thin: boolean }
type SendState = { kind: 'idle' | 'sending' | 'sent' | 'error'; message?: string }

const decode = (value: string | null) => {
  try {
    return value ? decodeURIComponent(value) : ''
  } catch {
    return ''
  }
}

/** Whether the screen is wide enough for a dialog (else a bottom sheet); decided on open. */
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

/**
 * "Preview this week": the e-mail as it would go out now, in a sandboxed frame (no scripts, no
 * same-origin access: sandbox="" and srcDoc), with its inbox line (from, subject, preheader) above.
 * A dialog from md up (phone or desktop width), a bottom sheet on phones. 'Send it to me' mails it
 * to the account's address; 'Turn on' when the digest is off.
 */
export default function DigestPreviewSheet({ open, onOpenChange, locale, email, enabled, onTurnOn }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  email: string | null
  enabled: boolean
  /** Turns the digest on; resolves to whether it worked. */
  onTurnOn: () => Promise<boolean>
}) {
  const t = useT()
  const wide = useWide()
  const [size, setSize] = useState<'phone' | 'desktop'>('desktop')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [send, setSend] = useState<SendState>({ kind: 'idle' })
  const [turningOn, setTurningOn] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const response = await fetch(`/api/digest/preview?locale=${encodeURIComponent(locale)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      setPreview({
        html: await response.text(),
        subject: decode(response.headers.get('x-digest-subject')),
        preheader: decode(response.headers.get('x-digest-preheader')),
        thin: response.headers.get('x-digest-thin') === '1',
      })
      setStatus('ready')
      setLoadedFor(locale)
    } catch {
      setStatus('error')
    }
  }, [locale])

  // Built when opened (and again only if the language changed since).
  useEffect(() => {
    if (open && loadedFor !== locale) void load()
    if (open) setSend({ kind: 'idle' })
  }, [open, locale, loadedFor, load])

  const sendToMe = async () => {
    setSend({ kind: 'sending' })
    try {
      const response = await fetch('/api/digest/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok) return setSend({ kind: 'sent', message: t('digest.preview.sent', { email: body?.email ?? email ?? '' }) })
      const message = body?.code === 'limit' ? t('digest.preview.limit')
        : body?.code === 'unverified' ? t('digest.unverifiedBlocked')
        : body?.code === 'unavailable' ? t('digest.unavailable')
        : t('digest.preview.sendFailed')
      setSend({ kind: 'error', message })
    } catch {
      setSend({ kind: 'error', message: t('digest.preview.sendFailed') })
    }
  }

  const turnOn = async () => {
    setTurningOn(true)
    await onTurnOn()
    setTurningOn(false)
  }

  const phone = !wide || size === 'phone'
  const title = t('digest.preview.title')

  // The frame takes the height the sheet or dialog leaves (the e-mail scrolls inside it), so the
  // actions below always stay in view: in the dialog up to a set height, on a phone all of it.
  const frame = (
    <div
      className={cn(
        'relative mx-auto flex w-full flex-col transition-[max-width] duration-300 ease-out',
        wide ? (phone ? 'h-[680px] min-h-[260px] max-w-[392px]' : 'h-[620px] min-h-[220px] max-w-[680px]') : 'min-h-[240px] flex-1',
      )}
    >
      <div
        className={cn(
          'relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black ring-1 ring-inset ring-white/10',
          wide && phone ? 'rounded-[34px] p-2 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] ring-white/15' : 'rounded-2xl',
        )}
      >
        <div className={cn('relative min-h-0 flex-1 overflow-hidden bg-black', wide && phone && 'rounded-[26px]')}>
          <AnimatePresence initial={false}>
            {status === 'ready' && preview && (
              <m.iframe
                key={`${loadedFor}`}
                title={t('digest.preview.frame')}
                sandbox=""
                srcDoc={preview.html}
                referrerPolicy="no-referrer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: tween.fast }}
                transition={tween.base}
                className="absolute inset-0 h-full w-full border-0 bg-black"
              />
            )}
          </AnimatePresence>
          {status === 'loading' && (
            <div role="status" className="absolute inset-0 flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 animate-pulse rounded-full bg-white/[0.08]" />
                <div className="h-3 w-20 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
              <div className="h-7 w-3/4 animate-pulse rounded-full bg-white/[0.08]" />
              <div className="aspect-[16/9] w-full animate-pulse rounded-[18px] bg-white/[0.06]" />
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((key) => <div key={key} className="aspect-[2/3] animate-pulse rounded-[10px] bg-white/[0.06]" />)}
              </div>
              <p className="mt-auto text-center text-[13px] text-white/55">{t('digest.preview.loading')}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="text-[15px] text-white/70">{t('digest.preview.failed')}</p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => void load()}>
                  <RotateCw aria-hidden className="h-4 w-4" />{t('digest.retry')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const inboxLine = (
    <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-inset ring-white/[0.06]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/A.svg" alt="" width={36} height={36} className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-black p-2 ring-1 ring-white/10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[14px] font-semibold text-white">{t('digest.preview.from')}</p>
          {email && <p className="hidden truncate text-[12.5px] text-white/50 sm:block"><bdi>{t('digest.preview.to', { email })}</bdi></p>}
        </div>
        {status === 'ready' && preview ? (
          <>
            <p dir="auto" className="truncate text-[14px] text-white">{preview.subject}</p>
            <p dir="auto" className="truncate text-[13px] text-white/55">{preview.preheader}</p>
          </>
        ) : (
          <div className="mt-1.5 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[0.05]" />
          </div>
        )}
      </div>
    </div>
  )

  const sendStatus = (send.kind === 'sent' || send.kind === 'error') && (
    send.kind === 'sent'
      ? <p className="flex min-w-0 items-center gap-1.5 text-white/70"><Check aria-hidden className="h-4 w-4 shrink-0 text-white" /><bdi className="truncate">{send.message}</bdi></p>
      : <p className="text-red-400">{send.message}</p>
  )

  const sendButton = (
    <Button variant="secondary" onClick={sendToMe} disabled={send.kind === 'sending' || send.kind === 'sent' || status !== 'ready'} className={cn(!wide && 'flex-1')}>
      <Send aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
      {send.kind === 'sending' ? t('digest.preview.sending') : t('digest.preview.send')}
    </Button>
  )

  const onState = enabled ? (
    <span className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2 text-[14px] font-medium text-white/70">
      <Check aria-hidden className="h-4 w-4 shrink-0" />{t('digest.preview.isOn')}
    </span>
  ) : (
    <Button onClick={turnOn} disabled={turningOn} className={cn(!wide && 'flex-1')}>{t('digest.preview.turnOn')}</Button>
  )

  const thinNote = status === 'ready' && preview?.thin && (
    <p className="flex items-start gap-2.5 rounded-2xl bg-amber-400/[0.07] p-3.5 text-[13.5px] leading-relaxed text-amber-100/85 ring-1 ring-inset ring-amber-300/15">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />{t('digest.preview.thin')}
    </p>
  )

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('flex max-h-[calc(100dvh-32px)] flex-col overflow-y-auto overscroll-contain p-6 transition-[max-width] duration-300 ease-out', phone ? 'max-w-[520px]' : 'max-w-[760px]')}>
          <div className="pe-10">
            <DialogTitle className="font-display text-[24px] font-bold leading-tight">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-[14px] text-white/55">{t('digest.preview.description')}</DialogDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {inboxLine}
            <SegmentedRadio<'phone' | 'desktop'>
              label={t('digest.preview.size')}
              value={size}
              onChange={setSize}
              className="self-start"
              options={[
                { value: 'desktop', label: t('digest.preview.desktop'), icon: <Laptop /> },
                { value: 'phone', label: t('digest.preview.phone'), icon: <Smartphone /> },
              ]}
            />
            {thinNote}
            {frame}
            <div className="flex items-center justify-between gap-4">
              <div aria-live="polite" className="min-w-0 text-[13px]">{sendStatus}</div>
              <div className="flex shrink-0 items-center gap-2">{sendButton}{onState}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  // Phones: the sheet is as tall as it can be; the e-mail fills the middle and the actions stay
  // pinned at the bottom, above the home indicator.
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92dvh]">
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3">
          <div>
            <DrawerTitle className="font-display text-[22px] font-bold leading-tight">{title}</DrawerTitle>
            <DrawerDescription className="mt-1 text-[14px] text-white/55">{t('digest.preview.description')}</DrawerDescription>
          </div>
          {inboxLine}
          {thinNote}
          {frame}
        </div>
        <div className="shrink-0 px-4 pb-4 pt-3">
          <div aria-live="polite" className="text-[13px] empty:hidden [&>p]:mb-2.5">{sendStatus}</div>
          <div className="flex items-center gap-2">{sendButton}{onState}</div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
