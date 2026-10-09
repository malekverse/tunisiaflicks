"use client"
// /support, 'Already supporting?': the account's code (TF-XXXXX) to write in the Ko-fi message,
// with Copy; for a supporter, the thank-you instead. Signed-in grown-ups only (the page shows the
// sign-in button to everyone else).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Copy, RotateCw } from 'lucide-react'
import BadgeArt from '@/src/components/badges/BadgeArt'
import { Button } from '@/src/components/ui/button'
import { TOUCH } from '@/src/components/badges/touch'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { formatDate } from '@/src/lib/i18n/format'
import { richT } from '@/src/lib/i18n/rich'
import { haptic } from '@/src/lib/motion'
import { useSupporter } from './use-supporter'

export default function SupportCode() {
  const { t, locale } = useI18n()
  const { status, state, load } = useSupporter()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  if (status === 'hidden') return null
  if (status === 'loading') {
    return (
      <div aria-busy className="mt-5 flex items-center gap-3">
        <Skeleton className="h-12 w-44 rounded-2xl" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
    )
  }
  if (status === 'error' || !state) {
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-white/60">{t('support.status.loadFailed')}</p>
        <Button type="button" size="sm" variant="secondary" className={TOUCH} onClick={() => void load()}>
          <RotateCw aria-hidden className="h-3.5 w-3.5" />{t('support.status.retry')}
        </Button>
      </div>
    )
  }

  const copy = async () => {
    if (!state.code) return
    try {
      await navigator.clipboard.writeText(state.code)
      haptic(8)
      setCopied(true)
    } catch {
      toast({ variant: 'destructive', title: t('support.already.copyFailed') })
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {state.supporter && (
        <div className="flex items-center gap-3.5 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-inset ring-white/[0.06]">
          <BadgeArt id="supporter" level={3} size={44} />
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-white">{t('support.already.thanks')}</p>
            <p className="mt-0.5 text-[13px] text-white/55">
              {richT(t, 'support.already.since', { date: formatDate(state.supporter.since, locale, { month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' }) })}
            </p>
          </div>
          <Link href="/profile#supporter" aria-label={t('nav.settings')} className="pressable ms-auto grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/60 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
            <ChevronRight aria-hidden className="h-5 w-5 rtl:rotate-180" />
          </Link>
        </div>
      )}
      {state.code && (
        <div>
          <p className="text-[13px] text-white/70" id="support-code-label">{t('support.already.label')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <output
              aria-labelledby="support-code-label"
              dir="ltr"
              className="select-all rounded-2xl bg-black/40 px-5 py-2.5 font-display text-[26px] font-bold tracking-[0.06em] text-white ring-1 ring-inset ring-white/10"
            >
              {state.code}
            </output>
            <Button type="button" variant="secondary" onClick={() => void copy()} aria-live="polite">
              {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
              {copied ? t('support.already.copied') : t('support.already.copy')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
