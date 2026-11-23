"use client"
// /gift/<token>: a gift of TunisiaFlicks+. Ready: who it's from (the name they wrote, or "a friend"),
// what Plus gives, and Redeem (sign in first). Then where Plus stands, and the way to its colours.
// Not paid yet, already taken, or no such gift: says so.
import React, { useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { BadgeCheck, Check, Crown, Gift, Hourglass, Link2Off, ListVideo, Loader2, Palette, Users, type LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import { LIMITS } from '@/src/lib/plus-rules'
import { spring } from '@/src/lib/motion'
import type { GiftPage } from '@/src/lib/plus-gifts'

type Done = { until: string }

export default function GiftRedeem({ token, gift, signedIn }: { token: string, gift: GiftPage | null, signedIn: boolean }) {
  const { t, dateLocale } = useI18n()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Done | null>(null)
  const [error, setError] = useState<string | null>(null)
  const here = `/gift/${token}`

  const redeem = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/plus/gifts/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error === 'used' ? t('gift.page.usedTitle') : body.error === 'unpaid' ? t('gift.page.unpaidTitle') : t('gift.page.failed'))
        return
      }
      setDone({ until: body.until })
    } catch {
      setError(t('gift.page.failed'))
    } finally {
      setBusy(false)
    }
  }

  const from = gift?.fromName ? t('gift.page.from', { name: gift.fromName }) : t('gift.page.fromFriend')
  const perks = [
    { icon: Palette, text: t('plus.perk.accent') },
    { icon: BadgeCheck, text: t('plus.perk.badge') },
    { icon: Users, text: t('plus.perk.profiles', { count: LIMITS.profiles.plus }) },
    { icon: ListVideo, text: t('plus.perk.lists', { count: LIMITS.lists.plus }) },
  ]

  let body: React.ReactNode
  if (done) {
    const until = new Date(done.until).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
    body = (
      <State icon={Check} tone="good" title={t('gift.page.doneTitle')} text={t('gift.page.doneText', { date: until })}>
        <Button asChild size="lg" className="mt-6"><Link href="/plus"><Palette aria-hidden className="h-4 w-4" />{t('gift.page.choose')}</Link></Button>
      </State>
    )
  } else if (!gift) {
    body = <State icon={Link2Off} title={t('gift.page.notFoundTitle')} text={t('gift.page.notFoundText')} />
  } else if (gift.status === 'unpaid') {
    body = <State icon={Hourglass} title={t('gift.page.unpaidTitle')} text={t('gift.page.unpaidText')} />
  } else if (gift.status === 'redeemed') {
    body = gift.mine
      ? (
        <State icon={Check} tone="good" title={t('gift.page.mineTitle')} text={t('gift.page.mineText')}>
          <Button asChild size="lg" className="mt-6"><Link href="/plus"><Crown aria-hidden className="h-4 w-4" />TunisiaFlicks+</Link></Button>
        </State>
      )
      : <State icon={Gift} title={t('gift.page.usedTitle')} text={t('gift.page.usedText')} />
  } else {
    body = (
      <>
        <p className="text-[14px] font-medium text-white/70">{from}</p>
        <h1 className="mt-2 font-display text-[clamp(34px,5vw,56px)] font-extrabold leading-[0.95] text-white">{t('gift.page.title')}</h1>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[14px] font-semibold text-black">
          <Crown aria-hidden className="h-4 w-4" />{t('gift.page.length', { count: gift.months })}
        </p>
        <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/70">{t('gift.page.text')}</p>
        <ul className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2 text-start">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 rounded-[14px] bg-white/[0.05] px-3 py-2.5 text-[13.5px] text-white/85">
              <Icon aria-hidden className="h-4 w-4 shrink-0 text-red-400" />{text}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {signedIn ? (
            <Button type="button" size="lg" onClick={redeem} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Gift aria-hidden className="h-4 w-4" />}{t('gift.page.redeem')}
            </Button>
          ) : (
            <>
              <Button asChild size="lg"><Link href={withCallback('/login', here)}><Gift aria-hidden className="h-4 w-4" />{t('gift.page.signIn')}</Link></Button>
              <Button asChild size="lg" variant="secondary"><Link href={withCallback('/signup', here)}>{t('gift.page.signUp')}</Link></Button>
            </>
          )}
        </div>
        {error && <p role="alert" className="mt-4 text-[14px] text-red-300">{error}</p>}
      </>
    )
  }

  return (
    <div className="page-top pb-16">
      <div className="page-x">
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.ui}
          className="relative isolate mx-auto max-w-[640px] overflow-hidden rounded-stage bg-gradient-to-br from-red-600/25 via-white/[0.04] to-transparent px-6 py-10 text-center ring-1 ring-white/10 rtl:bg-gradient-to-bl sm:px-10 sm:py-14"
        >
          <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-80 w-80 rounded-full bg-red-600/25 blur-3xl" />
          <div aria-hidden className="absolute -bottom-28 -start-20 -z-10 h-72 w-72 rounded-full bg-red-600/10 blur-3xl" />
          {!done && gift?.status === 'ready' && (
            <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-red-600 text-white shadow-[0_16px_40px_-10px_rgb(var(--red-600)/0.8)]"><Gift aria-hidden className="h-8 w-8" /></span>
          )}
          {body}
        </m.div>
      </div>
    </div>
  )
}

function State({ icon: Icon, title, text, tone, children }: { icon: LucideIcon, title: string, text: string, tone?: 'good', children?: React.ReactNode }) {
  return (
    <>
      <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${tone === 'good' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.07] text-white/70'}`}><Icon aria-hidden className="h-7 w-7" /></span>
      <h1 className="mt-5 font-display text-[clamp(26px,4vw,40px)] font-extrabold leading-tight text-white">{title}</h1>
      <p className="mx-auto mt-2 max-w-[44ch] text-[15px] leading-relaxed text-white/65">{text}</p>
      {children}
    </>
  )
}
