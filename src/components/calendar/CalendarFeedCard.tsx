"use client"
// Your release calendar (lib/calendar-feed): one private link, added once to Google or Apple
// Calendar, after which every film and episode you follow shows up there by itself. Shown in
// Settings > Following and on My shows. A new link retires the old one (two taps); turning it off
// stops the calendar updating.
import React, { useEffect, useState } from 'react'
import { CalendarPlus, Check, Copy, Link2Off, RefreshCw } from 'lucide-react'
import { FaApple, FaGoogle } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { cn } from '@/src/lib/utils'

type Feed = { https: string, webcal: string, google: string }

export default function CalendarFeedCard({ className }: { className?: string }) {
  const t = useT()
  const [feed, setFeed] = useState<Feed | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState<'renew' | 'off' | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/calendar/feed', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { feed: null }))
      .then((data) => { if (!cancelled) setFeed(data.feed ?? null) })
      .catch(() => { if (!cancelled) setFeed(null) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(null), 4000)
    return () => clearTimeout(timer)
  }, [armed])

  const call = async (method: 'POST' | 'DELETE') => {
    setBusy(true)
    try {
      const response = await fetch('/api/calendar/feed', { method })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      setFeed(data.feed ?? null)
      setArmed(null)
      toast({ title: method === 'POST' ? t('calendarFeed.ready') : t('calendarFeed.off'), duration: 3000 })
    } catch {
      toast({ title: t('common.error'), description: t('calendarFeed.failed'), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!feed) return
    try {
      await navigator.clipboard.writeText(feed.https)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: t('common.error'), description: t('calendarFeed.copyFailed'), variant: 'destructive' })
    }
  }

  if (feed === undefined) return null

  return (
    <section aria-labelledby="calendar-feed" className={cn('rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6', className)}>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-[0_10px_30px_-8px_rgb(229_15_5/0.6)]">
          <CalendarPlus aria-hidden className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="calendar-feed" className="font-display text-[20px] font-bold leading-tight text-white">{t('calendarFeed.title')}</h2>
          <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-white/60">{t('calendarFeed.text')}</p>
        </div>
      </div>

      {!feed ? (
        <Button type="button" className="mt-5" onClick={() => call('POST')} disabled={busy}>
          <CalendarPlus aria-hidden className="h-4 w-4" />{t('calendarFeed.create')}
        </Button>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <a href={feed.google} target="_blank" rel="noopener noreferrer"><FaGoogle aria-hidden className="h-4 w-4" />{t('calendarFeed.google')}</a>
            </Button>
            <Button asChild variant="secondary">
              <a href={feed.webcal}><FaApple aria-hidden className="h-4 w-4" />{t('calendarFeed.apple')}</a>
            </Button>
            <Button type="button" variant="secondary" onClick={copy}>
              {copied ? <Check aria-hidden className="h-4 w-4 text-emerald-300" /> : <Copy aria-hidden className="h-4 w-4" />}
              {copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
            </Button>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-white/55">{t('calendarFeed.private')}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button type="button" size="sm" variant={armed === 'renew' ? 'destructive' : 'ghost'} disabled={busy} onClick={() => (armed === 'renew' ? call('POST') : setArmed('renew'))}>
              <RefreshCw aria-hidden className="h-4 w-4" />{armed === 'renew' ? t('calendarFeed.renewSure') : t('calendarFeed.renew')}
            </Button>
            <Button type="button" size="sm" variant={armed === 'off' ? 'destructive' : 'ghost'} disabled={busy} onClick={() => (armed === 'off' ? call('DELETE') : setArmed('off'))}>
              <Link2Off aria-hidden className="h-4 w-4" />{armed === 'off' ? t('calendarFeed.turnOffSure') : t('calendarFeed.turnOff')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
