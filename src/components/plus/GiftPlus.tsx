"use client"
// /plus, "Give TunisiaFlicks+": make a gift, pay for it on Ko-fi with its code in the message, then
// send the friend its link (lib/plus-gifts). Every Ko-fi payment with the code is a month on the
// gift. While a new gift waits for its payment, the card checks by itself (every 10 seconds, for
// 10 minutes, only while the page is visible).
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Copy, ExternalLink, Gift, Hourglass, Loader2, RefreshCw, Share2, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { GIFT_FROM_MAX } from '@/src/lib/plus-rules'
import { spring } from '@/src/lib/motion'
import { supportUrl } from '@/src/lib/support-url'
import { cn } from '@/src/lib/utils'
import type { GiftView } from '@/src/lib/plus-gifts'

const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6'
const POLL_MS = 10_000
const POLL_FOR_MS = 10 * 60_000

export default function GiftPlus() {
  const { t, dateLocale } = useI18n()
  const kofi = supportUrl()
  const [gifts, setGifts] = useState<GiftView[] | null>(null)
  const [fromName, setFromName] = useState('')
  const [making, setMaking] = useState(false)
  const [checking, setChecking] = useState(false)
  const [watchUntil, setWatchUntil] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => { setCanShare(typeof navigator.share === 'function') }, [])

  const firstLoad = useRef(true)
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/plus/gifts', { cache: 'no-store' })
      if (!response.ok) return
      const list = ((await response.json()) as { gifts: GiftView[] }).gifts
      setGifts(list)
      // Back on the page soon after making one (paying on Ko-fi in another tab): keep checking.
      if (firstLoad.current && list.some((gift) => !gift.paid && Date.now() - new Date(gift.createdAt).getTime() < 3600_000)) setWatchUntil(Date.now() + POLL_FOR_MS)
      firstLoad.current = false
    } catch { /* offline: keep what's shown */ }
  }, [])
  useEffect(() => { load() }, [load])

  // The newest gift still waiting for its payment: checked by itself for a while after it's made.
  const waiting = gifts?.find((gift) => !gift.paid) ?? null
  useEffect(() => {
    if (!waiting || Date.now() > watchUntil) return
    const timer = window.setInterval(() => {
      if (Date.now() > watchUntil) return window.clearInterval(timer)
      if (document.visibilityState === 'visible') load()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [waiting, watchUntil, load])

  const make = async () => {
    setMaking(true)
    try {
      const response = await fetch('/api/plus/gifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromName }) })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409) return toast({ title: t('gift.title'), description: t('gift.tooMany') })
      if (!response.ok) throw new Error(String(response.status))
      setGifts((current) => [body.gift as GiftView, ...(current ?? [])])
      setWatchUntil(Date.now() + POLL_FOR_MS)
    } catch {
      toast({ title: t('common.error'), description: t('gift.page.failed'), variant: 'destructive' })
    } finally {
      setMaking(false)
    }
  }

  const checkAgain = async () => {
    setChecking(true)
    setWatchUntil(Date.now() + POLL_FOR_MS)
    await load()
    setChecking(false)
  }

  const cancel = async (code: string) => {
    const before = gifts
    setGifts((current) => current?.filter((gift) => gift.code !== code) ?? null)
    const response = await fetch(`/api/plus/gifts/${encodeURIComponent(code)}`, { method: 'DELETE' }).catch(() => null)
    if (response?.ok) toast({ title: t('gift.cancelled'), duration: 2500 })
    else { setGifts(before); toast({ title: t('common.error'), description: t('gift.page.failed'), variant: 'destructive' }) }
  }

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000)
    } catch {
      toast({ title: t('common.error'), description: t('calendarFeed.copyFailed'), variant: 'destructive' })
    }
  }

  if (!kofi) return null
  const date = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
  const fresh = waiting && Date.now() - new Date(waiting.createdAt).getTime() < 24 * 3600_000 ? waiting : null
  const justPaid = gifts?.find((gift) => gift.paid && !gift.redeemedAt) ?? null

  return (
    <section aria-labelledby="plus-gift" className={cn(panel, 'mt-6')}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <div className="lg:w-[42%]">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white"><Gift aria-hidden className="h-5 w-5" /></span>
          <h3 id="plus-gift" className="mt-4 text-[17px] font-semibold text-white">{t('gift.title')}</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-white/60">{t('gift.text')}</p>
          <label htmlFor="gift-from" className="mt-5 block text-[13px] font-medium text-white/60">{t('gift.fromLabel')}</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              id="gift-from"
              value={fromName}
              maxLength={GIFT_FROM_MAX}
              autoComplete="given-name"
              onChange={(event) => setFromName(event.target.value)}
              className="h-11 min-w-0 flex-1 basis-40 rounded-full bg-white/[0.05] px-4 text-[16px] sm:text-[14px]"
            />
            <Button type="button" onClick={make} disabled={making} className="h-11">
              {making ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Gift aria-hidden className="h-4 w-4" />}{t('gift.make')}
            </Button>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-white/50">{t('gift.rules')}</p>
        </div>

        <div className="min-w-0 flex-1">
          <AnimatePresence initial={false} mode="popLayout">
            {fresh && (
              // The gift just made: the code for Ko-fi, then waiting for the payment.
              <m.div key={`pay-${fresh.code}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.snappy} className="rounded-[18px] bg-white/[0.05] p-4 ring-1 ring-inset ring-white/10">
                <p className="text-[13px] font-medium text-white/60"><span className="me-2 inline-grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[11px] text-white">1</span>{t('gift.step1')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code dir="ltr" className="rounded-xl bg-black/40 px-4 py-2.5 font-mono text-[18px] font-bold tracking-wider text-white">{fresh.code}</code>
                  <Button type="button" variant="secondary" size="sm" onClick={() => copy(fresh.code, `code-${fresh.code}`)}>
                    {copied === `code-${fresh.code}` ? <Check aria-hidden className="h-4 w-4 text-emerald-300" /> : <Copy aria-hidden className="h-4 w-4" />}{copied === `code-${fresh.code}` ? t('calendarFeed.copied') : t('gift.copyCode')}
                  </Button>
                </div>
                <p className="mt-4 text-[13px] font-medium text-white/60"><span className="me-2 inline-grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[11px] text-white">2</span>{t('gift.step2')}</p>
                <Button asChild className="mt-2"><a href={kofi} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden className="h-4 w-4" />{t('gift.openKofi')}</a></Button>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4" role="status">
                  <Hourglass aria-hidden className="h-4 w-4 text-white/50" />
                  <p className="min-w-0 flex-1 text-[13px] text-white/60">{t('gift.waiting')}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={checkAgain} disabled={checking}>
                    <RefreshCw aria-hidden className={cn('h-4 w-4', checking && 'animate-spin')} />{t('gift.checkAgain')}
                  </Button>
                </div>
              </m.div>
            )}
            {!fresh && justPaid?.link && (
              // Paid and not redeemed yet: the link to send.
              <m.div key={`send-${justPaid.code}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.snappy} className="rounded-[18px] bg-gradient-to-br from-red-600/20 to-white/[0.04] p-4 ring-1 ring-inset ring-red-500/25 rtl:bg-gradient-to-bl">
                <p className="text-[16px] font-semibold text-white">{t('gift.paidTitle')}</p>
                <p className="mt-0.5 text-[13px] text-white/65">{t('gift.paidText')}</p>
                <p dir="ltr" className="mt-3 truncate rounded-full bg-black/30 px-4 py-2.5 text-[13.5px] text-white/85">{justPaid.link.replace(/^https?:\/\//, '')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`${t('gift.message')} ${justPaid.link}`)}`} target="_blank" rel="noopener noreferrer"><FaWhatsapp aria-hidden className="h-4 w-4" />WhatsApp</a>
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => copy(justPaid.link!, `link-${justPaid.code}`)}>
                    {copied === `link-${justPaid.code}` ? <Check aria-hidden className="h-4 w-4 text-emerald-300" /> : <Copy aria-hidden className="h-4 w-4" />}{copied === `link-${justPaid.code}` ? t('calendarFeed.copied') : t('gift.copyLink')}
                  </Button>
                  {canShare && (
                    <Button type="button" variant="secondary" onClick={() => navigator.share({ text: t('gift.message'), url: justPaid.link! }).catch(() => {})}>
                      <Share2 aria-hidden className="h-4 w-4" />{t('plus.invite.share')}
                    </Button>
                  )}
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {!!gifts?.length && (
            <div className={cn((fresh || justPaid) && 'mt-5')}>
              <p className="text-[13px] font-medium text-white/60">{t('gift.yours')}</p>
              <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-[16px] bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]">
                {gifts.map((gift) => (
                  <li key={gift.code} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                    <code dir="ltr" className="font-mono text-[13.5px] font-semibold text-white/85">{gift.code}</code>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-medium', gift.redeemedAt ? 'bg-white/[0.07] text-white/60' : gift.paid ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200')}>
                      {gift.redeemedAt ? t('gift.status.redeemed', { date: date(gift.redeemedAt) }) : gift.paid ? t('gift.status.ready') : t('gift.status.waiting')}
                    </span>
                    {gift.months > 0 && <span className="text-[12.5px] text-white/50">{t('gift.months', { count: gift.months })}</span>}
                    <span className="ms-auto flex gap-1">
                      {gift.link && !gift.redeemedAt && (
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => copy(gift.link!, `row-${gift.code}`)} aria-label={t('gift.copyLink')}>
                          {copied === `row-${gift.code}` ? <Check aria-hidden className="h-4 w-4 text-emerald-300" /> : <Copy aria-hidden className="h-4 w-4" />}
                        </Button>
                      )}
                      {!gift.paid && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => cancel(gift.code)}>
                          <X aria-hidden className="h-4 w-4" />{t('gift.cancel')}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
