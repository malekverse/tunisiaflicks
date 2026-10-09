"use client"
// The friend invite link card (/friends/list#add): whoever opens /u/handle?invite=... can become
// your friend in one tap. It says until when it works and how many times it was used; Share link
// opens the ShareSheet (outside apps and a QR code), Turn off link stops it, New link replaces it.
// Only a hash of the token is kept on the server, so the link itself is remembered on this device
// (a link made on another device can't be shown again: sharing it from here makes a new one).
import { useCallback, useEffect, useState } from 'react'
import { Link2, RotateCw, Share2 } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { toast } from '@/src/hooks/use-toast'
import { openShare } from '@/src/store/share-sheet'
import { socialErrorText } from './use-social-self'

type Status = { active: boolean; uses: number; maxUses: number; expiresAt: string | null }
type Saved = { url: string; expiresAt: string }

const storageKey = (handle: string) => `tf-friend-invite:${handle}`

function readSaved(handle: string): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(handle)) ?? 'null')
    return value && typeof value.url === 'string' && typeof value.expiresAt === 'string' ? value : null
  } catch {
    return null
  }
}

function writeSaved(handle: string, saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(storageKey(handle), JSON.stringify(saved))
    else localStorage.removeItem(storageKey(handle))
  } catch {
    // Private mode: the link is still shared now, just not remembered.
  }
}

const sameMoment = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && new Date(a).getTime() === new Date(b).getTime()

export default function ShareLinkRow({ handle, name }: { handle: string; name: string }) {
  const { t, dateLocale } = useI18n()
  const [status, setStatus] = useState<Status | null>(null)
  const [failed, setFailed] = useState(false)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const response = await fetch('/api/social/invite', { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      setStatus({ active: !!data.active, uses: data.uses ?? 0, maxUses: data.maxUses ?? 0, expiresAt: data.expiresAt ?? null })
      setSaved(readSaved(handle))
    } catch {
      setFailed(true)
    }
  }, [handle])

  useEffect(() => { void load() }, [load])

  const share = (url: string) => openShare({
    kind: 'invite',
    target: 'friend',
    url,
    title: t('social.invite.shareTitle', { name }),
    text: t('social.invite.shareText'),
  })

  /** A new link (the previous one stops working); null when it couldn't be made. */
  const create = async (): Promise<string | null> => {
    setBusy(true)
    try {
      const response = await fetch('/api/social/invite', { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast({ variant: 'destructive', title: body.code ? socialErrorText(t, body) : t('social.invite.linkFailed') })
        return null
      }
      const next: Saved = { url: body.url, expiresAt: new Date(body.expiresAt).toISOString() }
      writeSaved(handle, next)
      setSaved(next)
      setStatus({ active: true, uses: body.uses ?? 0, maxUses: body.maxUses ?? 10, expiresAt: next.expiresAt })
      return next.url
    } catch {
      toast({ variant: 'destructive', title: t('social.invite.linkFailed') })
      return null
    } finally {
      setBusy(false)
    }
  }

  const known = status?.active && saved && sameMoment(saved.expiresAt, status.expiresAt) ? saved.url : null
  const usedUp = !!status && !status.active && !!status.expiresAt

  const onShare = async () => {
    const url = known ?? (await create())
    if (url) share(url)
  }

  const turnOff = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/social/invite', { method: 'DELETE' })
      if (!response.ok) throw new Error(String(response.status))
      writeSaved(handle, null)
      setSaved(null)
      setStatus({ active: false, uses: 0, maxUses: 0, expiresAt: null })
    } catch {
      toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
    } finally {
      setBusy(false)
    }
  }

  const until = status?.expiresAt ? new Date(status.expiresAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' }) : null

  return (
    <section aria-labelledby="invite-link-title" className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><Link2 className="h-5 w-5 text-white/80" /></span>
        <div className="min-w-0 flex-1">
          <h3 id="invite-link-title" className="font-display text-[19px] font-bold leading-tight text-white">{t('social.invite.cardTitle')}</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-white/60">{t('social.invite.cardText')}</p>
        </div>
      </div>

      {!status && !failed && (
        <div aria-busy className="mt-5 flex gap-2.5"><Skeleton className="h-11 w-36 rounded-full" /><Skeleton className="h-11 w-28 rounded-full" /></div>
      )}

      {failed && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <p className="text-[14px] text-white/60">{t('social.privacy.loadFailed')}</p>
          <Button variant="secondary" className="h-11" onClick={() => void load()}><RotateCw aria-hidden className="h-4 w-4" />{t('social.inbox.retry')}</Button>
        </div>
      )}

      {status && (
        <>
          {status.active && until && (
            <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[13.5px] text-white/70">
              <span>{t('social.invite.worksUntil', { date: until })}</span>
              <span className="tabular-nums">{t('social.invite.used', { uses: status.uses, maxUses: status.maxUses })}</span>
            </p>
          )}
          {usedUp && <p className="mt-4 text-[13.5px] text-white/70">{t('social.invite.usedUp', { maxUses: status.maxUses })}</p>}
          {status.active && !known && <p className="mt-2 text-[13px] text-white/55">{t('social.invite.otherDevice')}</p>}

          <div className="mt-5 flex flex-wrap gap-2.5">
            {!usedUp && (
              <Button variant="secondary" className="h-11 px-5" onClick={() => void onShare()} disabled={busy}>
                <Share2 aria-hidden className="h-4 w-4" />{t('social.invite.share')}
              </Button>
            )}
            {(status.active || usedUp) && (
              <Button variant={usedUp ? 'secondary' : 'ghost'} className="h-11 px-5" onClick={async () => { const url = await create(); if (url && usedUp) share(url) }} disabled={busy}>
                {t('social.invite.newLink')}
              </Button>
            )}
            {status.active && (
              <Button variant="ghost" className="h-11 px-5 text-white/70" onClick={() => void turnOff()} disabled={busy}>
                {t('social.invite.turnOff')}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
