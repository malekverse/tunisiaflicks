"use client"
// The watch party, under the desktop app's player: start one (a code and a link to share), join
// one (from a link, or by typing its code), who's watching, the reactions, and leave. Outside the
// desktop app (or with an older one), a party link says how to join from the app.
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Copy, Loader2, LogOut, MonitorDown, PartyPopper, Share2, Users, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { useI18n } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import { toast } from '@/src/hooks/use-toast'
import { REACTIONS, normalizePartyCode } from '@/src/lib/party-rules'
import { tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { useWatchParty } from './use-watch-party'

type Party = ReturnType<typeof useWatchParty>
type Info = { hostName: string, title: string, full: boolean, mine: boolean } | null

export default function PartyPanel({ party, supported, inApp, signedIn, urlCode, open, onClose }: {
  party: Party
  /** The player takes part in parties (a desktop app player recent enough). */
  supported: boolean
  inApp: boolean
  signedIn: boolean
  /** ?party= in the address. */
  urlCode: string | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const [typed, setTyped] = useState('')
  const [info, setInfo] = useState<Info>(null)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => { setCanShare(typeof navigator.share === 'function') }, [])

  // A party link: whose party it is.
  useEffect(() => {
    if (!urlCode || party.role) return
    let cancelled = false
    fetch(`/api/party/${urlCode}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (!cancelled) setInfo(body) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [urlCode, party.role])

  const link = party.code && typeof window !== 'undefined' ? `${window.location.origin}/party/${party.code}` : null
  const message = t('party.message')
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: t('common.error'), description: t('calendarFeed.copyFailed'), variant: 'destructive' })
    }
  }
  const share = async () => {
    if (!link) return
    try { await navigator.share({ text: message, url: link }) } catch { /* dismissed */ }
  }

  const errorText = (code: string | null) => {
    switch (code) {
      case 'full': return t('party.error.full')
      case 'not_found': return t('party.error.notFound')
      case 'own': return t('party.error.own')
      case 'host_away': return t('party.error.hostAway')
      case 'code': return t('party.error.code')
      case 'start': return t('party.error.start')
      default: return t('party.error.join')
    }
  }

  const shell = (children: React.ReactNode) => (
    <AnimatePresence initial={false}>
      {(open || party.role || urlCode) && (
        <m.section
          key="party"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={tween.base}
          aria-labelledby="party-title"
          className="mt-3 rounded-[20px] bg-white/[0.04] p-4 ring-1 ring-inset ring-white/[0.08] sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-600 text-white"><PartyPopper aria-hidden className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">{children}</div>
            {!party.role && (
              <button type="button" onClick={onClose} aria-label={t('common.close')} className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/55 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white">
                <X aria-hidden className="h-4 w-4" />
              </button>
            )}
          </div>
        </m.section>
      )}
    </AnimatePresence>
  )

  // Outside the desktop app (or an older one): how to join.
  if (!inApp || !supported) {
    if (!urlCode && !open) return null
    return shell(
      <>
        <h3 id="party-title" className="text-[16px] font-semibold text-white">{info?.hostName ? t('party.invitedBy', { name: info.hostName }) : t('party.title')}</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-white/65">{inApp ? t('party.update') : t('party.needsApp')}</p>
        {urlCode && <p className="mt-3 font-display text-[28px] font-extrabold tracking-[0.18em] text-white" dir="ltr">{urlCode}</p>}
        {!inApp && <Button asChild size="sm" className="mt-3"><Link href="/desktop"><MonitorDown aria-hidden className="h-4 w-4" />{t('party.getApp')}</Link></Button>}
      </>,
    )
  }

  if (!signedIn) {
    if (!urlCode && !open) return null
    return shell(
      <>
        <h3 id="party-title" className="text-[16px] font-semibold text-white">{info?.hostName ? t('party.invitedBy', { name: info.hostName }) : t('party.title')}</h3>
        <p className="mt-1 text-[14px] text-white/65">{t('party.signIn')}</p>
        <Button asChild size="sm" className="mt-3"><Link href={withCallback('/login', typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')}>{t('party.signInButton')}</Link></Button>
      </>,
    )
  }

  // In a party.
  if (party.role) {
    const connecting = party.status === 'joining' || party.status === 'waiting' || party.status === 'lost'
    const ended = party.status === 'ended' || party.status === 'failed'
    return shell(
      <>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 id="party-title" className="text-[16px] font-semibold text-white">{party.role === 'host' ? t('party.hosting') : t('party.guest')}</h3>
          {party.code && <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 font-mono text-[13px] tracking-[0.14em] text-white/85" dir="ltr">{party.code}</span>}
        </div>
        <p className="mt-1 flex items-center gap-2 text-[13.5px] text-white/65">
          {connecting && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
          {ended
            ? (party.status === 'ended' ? t('party.ended') : errorText(party.error))
            : connecting
              ? t(party.status === 'waiting' ? 'party.waitingHost' : party.status === 'lost' ? 'party.reconnecting' : 'party.joining')
              : party.people.length > 1 ? t('party.watching', { count: party.people.length }) : t('party.alone')}
        </p>

        {party.people.length > 0 && !ended && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('party.people')}>
            {party.people.map((name, index) => (
              <li key={`${name}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[13px] text-white/85">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{name || t('party.someone')}
              </li>
            ))}
          </ul>
        )}

        {!ended && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t('party.react')}>
            {REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => party.react(emoji)} disabled={connecting} className="pressable grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-[20px] outline-none transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40">
                <span aria-hidden>{emoji}</span><span className="sr-only">{t('party.sendReaction', { emoji })}</span>
              </button>
            ))}
          </div>
        )}

        {party.role === 'host' && link && !ended && (
          <div className="mt-4">
            <p className="text-[13px] text-white/60">{t('party.invite')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild size="sm"><a href={`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`} target="_blank" rel="noopener noreferrer"><FaWhatsapp aria-hidden className="h-4 w-4" />WhatsApp</a></Button>
              <Button type="button" size="sm" variant="secondary" onClick={copy}>{copied ? <Check aria-hidden className="h-4 w-4 text-emerald-300" /> : <Copy aria-hidden className="h-4 w-4" />}{copied ? t('calendarFeed.copied') : t('party.copy')}</Button>
              {canShare && <Button type="button" size="sm" variant="secondary" onClick={share}><Share2 aria-hidden className="h-4 w-4" />{t('plus.invite.share')}</Button>}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={party.leave}><LogOut aria-hidden className="h-4 w-4 rtl:rotate-180" />{party.role === 'host' && !ended ? t('party.end') : t('party.leave')}</Button>
          <p className="text-[12px] text-white/45">{t('party.privacy')}</p>
        </div>
      </>,
    )
  }

  // A party link, not joined yet.
  if (urlCode) {
    const code = normalizePartyCode(urlCode)
    return shell(
      <>
        <h3 id="party-title" className="text-[16px] font-semibold text-white">{info?.hostName ? t('party.invitedBy', { name: info.hostName }) : t('party.title')}</h3>
        <p className="mt-1 text-[14px] text-white/65">{info ? (info.full ? t('party.error.full') : t('party.joinText')) : t('party.error.notFound')}</p>
        {party.error && <p role="alert" className="mt-2 text-[13.5px] text-red-300">{errorText(party.error)}</p>}
        {info && !info.full && code && (
          <Button type="button" size="sm" className="mt-3" onClick={() => party.join(code)} disabled={party.status === 'joining'}>
            <Users aria-hidden className="h-4 w-4" />{t('party.join')}
          </Button>
        )}
      </>,
    )
  }

  // Start or join.
  return shell(
    <>
      <h3 id="party-title" className="text-[16px] font-semibold text-white">{t('party.title')}</h3>
      <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-white/65">{t('party.text')}</p>
      {party.error && <p role="alert" className="mt-2 text-[13.5px] text-red-300">{errorText(party.error)}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={party.start} disabled={party.status === 'starting'}>
          {party.status === 'starting' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <PartyPopper aria-hidden className="h-4 w-4" />}{t('party.start')}
        </Button>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => { event.preventDefault(); party.join(typed) }}
        >
          <Input value={typed} onChange={(event) => setTyped(event.target.value.toUpperCase().slice(0, 8))} placeholder={t('party.codePlaceholder')} aria-label={t('party.codeLabel')} className={cn('h-9 w-[130px] font-mono tracking-[0.14em]')} dir="ltr" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          <Button type="submit" size="sm" variant="secondary" disabled={!normalizePartyCode(typed)}>{t('party.join')}</Button>
        </form>
      </div>
    </>,
  )
}
