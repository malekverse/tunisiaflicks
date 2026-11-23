"use client"
// /plus: TunisiaFlicks+. Where you stand (on until a date, or not yet), what it gives (accent
// colours, a badge on your page, more profiles and lists), and the two ways to get it: a coffee
// or a monthly membership on Ko-fi (/support links it to the account), or three friends who join
// through your link for each free month. Sharing it with a family (FamilyPlus), and giving it to a
// friend (GiftPlus).
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { BadgeCheck, Check, Coffee, Copy, Crown, Gift, ListVideo, Lock, Palette, Share2, Sparkles, Users } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { ACCENTS, FRIENDS_PER_MONTH, INVITE_MONTHS_MAX, LIMITS, type Accent } from '@/src/lib/plus-rules'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { applyAccent } from './PlusSync'
import GiftPlus from './GiftPlus'
import FamilyPlus from './FamilyPlus'

export type PlusData = {
  active: boolean
  accent: Accent
  until: string | null
  daysLeft: number
  showBadge: boolean
  membership: boolean
  viaFamily: boolean
  invite: { link: string | null, friends: number, waiting: number, months: number, towardsNext: number }
}

/** The swatch of each accent (its 500): the same values as globals.css. */
const SWATCH: Record<Accent, string> = {
  red: '#FF2414', gold: '#f59e0b', emerald: '#10b981', ocean: '#0ea5e9', violet: '#8b5cf6', rose: '#ec4899',
}
const ACCENT_LABEL: Record<Accent, 'plus.accent.red' | 'plus.accent.gold' | 'plus.accent.emerald' | 'plus.accent.ocean' | 'plus.accent.violet' | 'plus.accent.rose'> = {
  red: 'plus.accent.red', gold: 'plus.accent.gold', emerald: 'plus.accent.emerald', ocean: 'plus.accent.ocean', violet: 'plus.accent.violet', rose: 'plus.accent.rose',
}

const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6'

export default function PlusView({ initial, kofi }: { initial: PlusData, kofi: boolean }) {
  const { t, dateLocale } = useI18n()
  const [data, setData] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => { setCanShare(typeof navigator.share === 'function') }, [])

  const save = async (prefs: { accent?: Accent, showBadge?: boolean }) => {
    const before = data
    setData((current) => ({ ...current, ...prefs }))
    if (prefs.accent) applyAccent(prefs.accent)
    setSaving(true)
    try {
      const response = await fetch('/api/plus', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) })
      if (!response.ok) throw new Error(String(response.status))
    } catch {
      setData(before)
      if (prefs.accent) applyAccent(before.accent)
      toast({ title: t('common.error'), description: t('plus.saveFailed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const link = data.invite.link
  const shareText = t('plus.invite.message')
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
    try { await navigator.share({ text: shareText, url: link }) } catch { /* dismissed */ }
  }

  const until = data.until ? new Date(data.until).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const maxed = data.invite.months >= INVITE_MONTHS_MAX

  const perks = [
    { icon: Palette, title: t('plus.perk.accent'), text: t('plus.perk.accentText') },
    { icon: BadgeCheck, title: t('plus.perk.badge'), text: t('plus.perk.badgeText') },
    { icon: Users, title: t('plus.perk.profiles', { count: LIMITS.profiles.plus }), text: t('plus.perk.profilesText', { free: LIMITS.profiles.free }) },
    { icon: ListVideo, title: t('plus.perk.lists', { count: LIMITS.lists.plus }), text: t('plus.perk.listsText', { free: LIMITS.lists.free }) },
  ]

  return (
    <div className="page-top pb-16">
      <div className="page-x">
        <div className="mx-auto max-w-[1000px]">
          {/* Where you stand. */}
          <header className="relative isolate overflow-hidden rounded-stage bg-gradient-to-br from-red-600/25 via-white/[0.04] to-transparent p-6 ring-1 ring-white/10 rtl:bg-gradient-to-bl sm:p-10">
            <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-80 w-80 rounded-full bg-red-600/25 blur-3xl" />
            <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-red-600 text-white shadow-[0_16px_40px_-10px_rgb(var(--red-600)/0.8)]"><Crown aria-hidden className="h-7 w-7" /></span>
            <h1 className="mt-5 font-display text-[clamp(36px,5.4vw,64px)] font-extrabold leading-[0.95] text-white">TunisiaFlicks+</h1>
            <p className="mt-3 max-w-[56ch] text-[15.5px] leading-relaxed text-white/70">{t('plus.subtitle')}</p>
            <p className={cn('mt-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-medium', data.active ? 'bg-white text-black' : 'bg-white/[0.08] text-white/80')}>
              {data.active ? <Check aria-hidden className="h-4 w-4" /> : <Lock aria-hidden className="h-4 w-4" />}
              {data.active
                ? (data.viaFamily ? t('family.status', { date: until ?? '' }) : data.membership ? t('plus.status.membership') : t('plus.status.until', { date: until ?? '' }))
                : t('plus.status.off')}
            </p>
          </header>

          {/* What it gives. */}
          <section aria-labelledby="plus-perks" className="mt-8">
            <h2 id="plus-perks" className="font-display text-[22px] font-bold sm:text-[26px]">{t('plus.perks')}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {perks.map(({ icon: Icon, title, text }) => (
                <li key={title} className={cn(panel, 'flex gap-4')}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><Icon aria-hidden className="h-5 w-5 text-red-400" /></span>
                  <span>
                    <span className="block text-[16px] font-semibold text-white">{title}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-relaxed text-white/60">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* The perks' settings (locked until Plus is on). */}
          <section aria-labelledby="plus-yours" className={cn(panel, 'mt-6')}>
            <h2 id="plus-yours" className="font-display text-[20px] font-bold">{t('plus.yours')}</h2>
            {!data.active && <p className="mt-1 text-[13.5px] text-white/60">{t('plus.locked')}</p>}
            <p id="plus-accent" className="mt-5 text-[13px] font-medium text-white/60">{t('plus.perk.accent')}</p>
            <div role="radiogroup" aria-labelledby="plus-accent" className="mt-2 flex flex-wrap gap-2.5">
              {ACCENTS.map((accent) => {
                const on = data.accent === accent
                return (
                  <button
                    key={accent}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!data.active || saving}
                    onClick={() => save({ accent })}
                    className={cn(
                      'pressable inline-flex h-11 items-center gap-2 rounded-full pe-4 ps-1.5 text-[14px] font-medium outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-45',
                      on ? 'bg-white text-black ring-white' : 'bg-white/[0.05] text-white/80 ring-white/10 hover:text-white',
                    )}
                  >
                    <span className="relative grid h-8 w-8 place-items-center rounded-full" style={{ background: SWATCH[accent] }}>
                      {on && <m.span layoutId="plus-accent-on" transition={spring.snappy}><Check aria-hidden className="h-4 w-4 text-white" strokeWidth={3} /></m.span>}
                    </span>
                    {t(ACCENT_LABEL[accent])}
                  </button>
                )
              })}
            </div>
            <label className={cn('mt-6 flex items-center gap-4 rounded-[16px] bg-white/[0.04] p-4', !data.active && 'opacity-50')}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">{t('plus.badgeSwitch')}</span>
                <span className="mt-0.5 block text-[13px] text-white/60">{t('plus.badgeSwitchText')}</span>
              </span>
              <Switch checked={data.showBadge} disabled={!data.active || saving} onCheckedChange={(showBadge) => save({ showBadge })} aria-label={t('plus.badgeSwitch')} />
            </label>
          </section>

          {/* How to get it. */}
          <section aria-labelledby="plus-get" className="mt-8">
            <h2 id="plus-get" className="font-display text-[22px] font-bold sm:text-[26px]">{data.active ? t('plus.getMore') : t('plus.get')}</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className={panel}>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white"><Coffee aria-hidden className="h-5 w-5" /></span>
                <h3 className="mt-4 text-[17px] font-semibold text-white">{t('plus.kofi.title')}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-white/60">{t('plus.kofi.text')}</p>
                {kofi
                  ? <Button asChild className="mt-5"><Link href="/support"><Coffee aria-hidden className="h-4 w-4" />{t('plus.kofi.button')}</Link></Button>
                  : <p className="mt-5 text-[13.5px] text-white/55">{t('plus.kofi.soon')}</p>}
              </div>

              <div className={panel}>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white"><Gift aria-hidden className="h-5 w-5" /></span>
                <h3 className="mt-4 text-[17px] font-semibold text-white">{t('plus.invite.title')}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-white/60">{t('plus.invite.text', { count: FRIENDS_PER_MONTH })}</p>

                {/* This round's friends: a dot each. */}
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex gap-1.5" aria-hidden>
                    {Array.from({ length: FRIENDS_PER_MONTH }, (_, index) => (
                      <span key={index} className={cn('grid h-9 w-9 place-items-center rounded-full ring-1 ring-inset', index < data.invite.towardsNext ? 'bg-red-600 text-white ring-red-600' : 'bg-white/[0.04] text-white/30 ring-white/10')}>
                        <Users className="h-4 w-4" />
                      </span>
                    ))}
                  </div>
                  <p className="text-[13.5px] text-white/70">
                    {maxed ? t('plus.invite.maxed', { count: INVITE_MONTHS_MAX }) : t('plus.invite.progress', { count: data.invite.towardsNext, max: FRIENDS_PER_MONTH })}
                  </p>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 text-[12.5px] text-white/55">
                  <span>{t('plus.invite.joined', { count: data.invite.friends })}</span>
                  {data.invite.waiting > 0 && <span>{t('plus.invite.waiting', { count: data.invite.waiting })}</span>}
                  {data.invite.months > 0 && <span className="text-white/75">{t('plus.invite.months', { count: data.invite.months })}</span>}
                </p>

                {link && (
                  <>
                    <p className="mt-5 truncate rounded-full bg-white/[0.06] px-4 py-2.5 text-[13.5px] text-white/80" dir="ltr">{link.replace(/^https?:\/\//, '')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild>
                        <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}`} target="_blank" rel="noopener noreferrer"><FaWhatsapp aria-hidden className="h-4 w-4" />WhatsApp</a>
                      </Button>
                      <Button type="button" variant="secondary" onClick={copy}>
                        {copied ? <Check aria-hidden className="h-4 w-4 text-emerald-300" /> : <Copy aria-hidden className="h-4 w-4" />}{copied ? t('calendarFeed.copied') : t('plus.invite.copy')}
                      </Button>
                      {canShare && <Button type="button" variant="secondary" onClick={share}><Share2 aria-hidden className="h-4 w-4" />{t('plus.invite.share')}</Button>}
                    </div>
                  </>
                )}
                <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-white/50"><Sparkles aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('plus.invite.rules')}</p>
              </div>
            </div>
            <FamilyPlus kofi={kofi} />
            <GiftPlus />
          </section>
        </div>
      </div>
    </div>
  )
}
