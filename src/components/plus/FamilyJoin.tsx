"use client"
// /family/<token>: someone's Family Plus. Open: whose family it is, the places left, what Plus
// gives, and Join (sign in first). Then where Plus stands. Full, ended, your own, already in it,
// in another family, or no such link: says so.
import React, { useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { BadgeCheck, Check, Crown, Home, Hourglass, Link2Off, ListVideo, Loader2, Palette, Users, type LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import { LIMITS } from '@/src/lib/plus-rules'
import { spring } from '@/src/lib/motion'
import type { FamilyInvite } from '@/src/lib/plus-family'

export default function FamilyJoin({ token, invite, signedIn }: { token: string, invite: FamilyInvite | null, signedIn: boolean }) {
  const { t, dateLocale } = useI18n()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const here = `/family/${token}`

  const errorText = (code: unknown) => {
    if (code === 'full') return t('family.page.fullTitle')
    if (code === 'ended') return t('family.page.endedTitle')
    if (code === 'elsewhere') return t('family.page.elsewhereTitle')
    return t('family.page.failed')
  }

  const join = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/plus/family', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', token }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(errorText(body.error))
        return
      }
      setDone(body.until)
    } catch {
      setError(t('family.page.failed'))
    } finally {
      setBusy(false)
    }
  }

  const holder = invite?.holderName ? t('family.page.from', { name: invite.holderName }) : t('family.page.fromSomeone')
  const perks = [
    { icon: Palette, text: t('plus.perk.accent') },
    { icon: BadgeCheck, text: t('plus.perk.badge') },
    { icon: Users, text: t('plus.perk.profiles', { count: LIMITS.profiles.plus }) },
    { icon: ListVideo, text: t('plus.perk.lists', { count: LIMITS.lists.plus }) },
  ]
  const toPlus = <Button asChild size="lg" className="mt-6"><Link href="/plus"><Crown aria-hidden className="h-4 w-4" />TunisiaFlicks+</Link></Button>

  let body: React.ReactNode
  if (done) {
    const until = new Date(done).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
    body = (
      <State icon={Check} tone="good" title={t('family.page.doneTitle')} text={t('family.page.doneText', { date: until })}>
        <Button asChild size="lg" className="mt-6"><Link href="/plus"><Palette aria-hidden className="h-4 w-4" />{t('gift.page.choose')}</Link></Button>
      </State>
    )
  } else if (!invite) {
    body = <State icon={Link2Off} title={t('family.page.notFoundTitle')} text={t('family.page.notFoundText')} />
  } else if (invite.status === 'own') {
    body = <State icon={Home} title={t('family.page.ownTitle')} text={t('family.page.ownText')}>{toPlus}</State>
  } else if (invite.status === 'joined') {
    body = <State icon={Check} tone="good" title={t('family.page.joinedTitle')} text={t('family.page.joinedText')}>{toPlus}</State>
  } else if (invite.status === 'ended') {
    body = <State icon={Hourglass} title={t('family.page.endedTitle')} text={t('family.page.endedText')} />
  } else if (invite.status === 'full') {
    body = <State icon={Users} title={t('family.page.fullTitle')} text={t('family.page.fullText')} />
  } else if (invite.status === 'elsewhere') {
    body = <State icon={Users} title={t('family.page.elsewhereTitle')} text={t('family.page.elsewhereText')}>{toPlus}</State>
  } else {
    body = (
      <>
        <p className="text-[14px] font-medium text-white/70">{holder}</p>
        <h1 className="mt-2 font-display text-[clamp(34px,5vw,56px)] font-extrabold leading-[0.95] text-white">{t('family.page.title')}</h1>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[14px] font-semibold text-black">
          <Users aria-hidden className="h-4 w-4" />{t('family.page.seats', { count: invite.seatsLeft })}
        </p>
        <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/70">{t('family.page.text')}</p>
        <ul className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2 text-start">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 rounded-[14px] bg-white/[0.05] px-3 py-2.5 text-[13.5px] text-white/85">
              <Icon aria-hidden className="h-4 w-4 shrink-0 text-red-400" />{text}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {signedIn ? (
            <Button type="button" size="lg" onClick={join} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Home aria-hidden className="h-4 w-4" />}{t('family.page.join')}
            </Button>
          ) : (
            <>
              <Button asChild size="lg"><Link href={withCallback('/login', here)}><Home aria-hidden className="h-4 w-4" />{t('family.page.signIn')}</Link></Button>
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
          {!done && invite?.status === 'open' && (
            <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-red-600 text-white shadow-[0_16px_40px_-10px_rgb(var(--red-600)/0.8)]"><Home aria-hidden className="h-8 w-8" /></span>
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
