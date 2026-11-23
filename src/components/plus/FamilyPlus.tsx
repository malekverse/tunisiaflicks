"use client"
// /plus, "Family Plus" (lib/plus-family): the Family membership on Ko-fi shares Plus with up to
// three other accounts. Paying for one: the family link (WhatsApp, copy, share, a new link), the
// places and who took them (remove). In someone's family: whose, until when, and Leave. Neither:
// how to get one.
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Home, Loader2, LogOut, RefreshCw, Share2, User, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { FAMILY_SEATS } from '@/src/lib/plus-rules'
import { cn } from '@/src/lib/utils'
import type { FamilyState } from '@/src/lib/plus-family'

const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6'

export default function FamilyPlus({ kofi, onChange }: { kofi: boolean, onChange?: () => void }) {
  const { t, dateLocale } = useI18n()
  const [state, setState] = useState<FamilyState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => { setCanShare(typeof navigator.share === 'function') }, [])

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/plus/family', { cache: 'no-store' })
      if (response.ok) setState(await response.json())
    } catch { /* offline: keep what's shown */ }
  }, [])
  useEffect(() => { load() }, [load])

  const date = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
  const failed = () => toast({ title: t('common.error'), description: t('family.failed'), variant: 'destructive' })

  const act = async (key: string, run: () => Promise<Response>) => {
    setBusy(key)
    try {
      const response = await run()
      if (!response.ok) throw new Error(String(response.status))
      await load()
      onChange?.()
    } catch {
      failed()
    } finally {
      setBusy(null)
    }
  }
  const remove = (id: string) => act(`remove:${id}`, () => fetch(`/api/plus/family?member=${encodeURIComponent(id)}`, { method: 'DELETE' }))
  const leave = () => {
    if (!window.confirm(t('family.leaveConfirm'))) return
    act('leave', () => fetch('/api/plus/family', { method: 'DELETE' }))
  }
  const newLink = () => {
    if (!window.confirm(t('family.newLinkConfirm'))) return
    act('newLink', () => fetch('/api/plus/family', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'newLink' }) }))
  }

  if (!state) return null

  const header = (
    <div className="flex items-start gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-600 text-white"><Home aria-hidden className="h-5 w-5" /></span>
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold text-white">{t('family.title')}</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-white/60">{t('family.text', { count: FAMILY_SEATS })}</p>
      </div>
    </div>
  )

  if (state.role === 'member') {
    return (
      <div className={cn(panel, 'mt-3')}>
        {header}
        <p className="mt-5 rounded-[16px] bg-white/[0.05] p-4 text-[14.5px] text-white/85">
          {state.holderName ? t('family.member', { name: state.holderName, date: date(state.until) }) : t('family.memberNoName', { date: date(state.until) })}
        </p>
        <Button type="button" variant="secondary" className="mt-4" onClick={leave} disabled={busy === 'leave'}>
          {busy === 'leave' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <LogOut aria-hidden className="h-4 w-4" />}{t('family.leave')}
        </Button>
      </div>
    )
  }

  if (state.role === 'none') {
    return (
      <div className={cn(panel, 'mt-3')}>
        {header}
        <ol className="mt-5 space-y-2 text-[14px] text-white/75">
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[12px] font-semibold">1</span>{t('family.how1')}</li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[12px] font-semibold">2</span>{t('family.how2')}</li>
          <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[12px] font-semibold">3</span>{t('family.how3', { count: FAMILY_SEATS })}</li>
        </ol>
        {kofi && <Button asChild className="mt-5"><Link href="/support"><Home aria-hidden className="h-4 w-4" />{t('family.get')}</Link></Button>}
      </div>
    )
  }

  // The account pays for a family.
  const link = state.link
  const message = t('family.message')
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

  return (
    <div className={cn(panel, 'mt-3')}>
      {header}
      <p className={cn('mt-5 inline-flex rounded-full px-3.5 py-1.5 text-[13.5px] font-medium', state.active ? 'bg-white text-black' : 'bg-white/[0.08] text-white/80')}>
        {state.active ? t('family.until', { date: date(state.until!) }) : t('family.ended', { date: date(state.until!) })}
      </p>

      <ul className="mt-5 grid gap-2 sm:grid-cols-3">
        {Array.from({ length: state.seats }, (_, index) => {
          const member = state.members[index]
          return (
            <li key={member?.id ?? `seat-${index}`} className={cn('flex min-h-[56px] items-center gap-3 rounded-[16px] px-3 py-2.5', member ? 'bg-white/[0.06] ring-1 ring-inset ring-white/10' : 'border border-dashed border-white/15')}>
              {member ? (
                <>
                  {member.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={member.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08]"><User aria-hidden className="h-4 w-4 text-white/60" /></span>}
                  <span className="min-w-0 flex-1 truncate text-[14px] text-white">{member.name || t('family.someone')}</span>
                  <button
                    type="button"
                    onClick={() => remove(member.id)}
                    disabled={busy === `remove:${member.id}`}
                    aria-label={t('family.remove', { name: member.name || t('family.someone') })}
                    className="pressable grid h-8 w-8 place-items-center rounded-full text-white/50 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {busy === `remove:${member.id}` ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <X aria-hidden className="h-4 w-4" />}
                  </button>
                </>
              ) : (
                <span className="text-[13.5px] text-white/45">{t('family.free')}</span>
              )}
            </li>
          )
        })}
      </ul>

      {link ? (
        <>
          <p className="mt-5 text-[13px] font-medium text-white/60">{t('family.linkLabel')}</p>
          <p className="mt-2 truncate rounded-full bg-white/[0.06] px-4 py-2.5 text-[13.5px] text-white/80" dir="ltr">{link.replace(/^https?:\/\//, '')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`} target="_blank" rel="noopener noreferrer"><FaWhatsapp aria-hidden className="h-4 w-4" />WhatsApp</a>
            </Button>
            <Button type="button" variant="secondary" onClick={copy}>
              {copied ? <Check aria-hidden className="h-4 w-4 text-emerald-300" /> : <Copy aria-hidden className="h-4 w-4" />}{copied ? t('calendarFeed.copied') : t('family.copy')}
            </Button>
            {canShare && <Button type="button" variant="secondary" onClick={share}><Share2 aria-hidden className="h-4 w-4" />{t('plus.invite.share')}</Button>}
            <Button type="button" variant="ghost" onClick={newLink} disabled={busy === 'newLink'}>
              {busy === 'newLink' ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden className="h-4 w-4" />}{t('family.newLink')}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-5 text-[13.5px] text-white/60">{t('family.renew')}</p>
      )}
      <p className="mt-4 text-[12.5px] leading-relaxed text-white/50">{t('family.rules')}</p>
    </div>
  )
}
