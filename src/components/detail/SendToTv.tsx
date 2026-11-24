"use client"
// "Play on my TV" (lib/tv-send), the sender's side, under the player on a phone or a computer: the
// account's TVs signed in with a code; with one, it's sent straight away, with several, you pick.
// With none, how to sign a TV in.
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MonitorPlay, Tv } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import type { TKey } from '@/src/lib/i18n'
import type { LocalMedia } from '@/src/hooks/use-desktop-app'

type TvItem = { id: string, deviceLabel: string, profileName: string | null, lastSeenAt: string }

export default function SendToTv({ media, title }: { media: LocalMedia, title: string }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<null | 'none' | TvItem[]>(null)
  const device = (label: string) => t(`tvMode.device.${label}` as TKey)

  const send = async (tv: TvItem) => {
    setBusy(true)
    try {
      const response = await fetch('/api/tv/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tv: tv.id, media, title }) })
      if (!response.ok) throw new Error(String(response.status))
      setOpen(null)
      toast({ title: t('tvSend.sent', { device: device(tv.deviceLabel) }), description: t('tvSend.sentText'), duration: 5000 })
    } catch {
      toast({ title: t('common.error'), description: t('tvSend.failed'), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/tv/sessions', { cache: 'no-store' })
      const tvs: TvItem[] = response.ok ? (await response.json()).sessions ?? [] : []
      if (tvs.length === 1) return await send(tvs[0])
      setOpen(tvs.length ? tvs : 'none')
    } catch {
      toast({ title: t('common.error'), description: t('tvSend.failed'), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={start} disabled={busy} className="h-9">
        {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <MonitorPlay aria-hidden className="h-4 w-4" />}{t('tvSend.button')}
      </Button>
      <Dialog open={open !== null} onOpenChange={(value) => { if (!value) setOpen(null) }}>
        <DialogContent>
          <DialogTitle className="font-display text-[22px] font-bold">{t(open === 'none' ? 'tvSend.noneTitle' : 'tvSend.pick')}</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-white/65">{t(open === 'none' ? 'tvSend.noneText' : 'tvSend.pickText')}</DialogDescription>
          {Array.isArray(open) ? (
            <ul className="grid gap-2">
              {open.map((tv) => (
                <li key={tv.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => send(tv)}
                    className="pressable flex w-full items-center gap-3 rounded-[14px] bg-white/[0.06] px-4 py-3 text-start outline-none hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
                  >
                    <Tv aria-hidden className="h-5 w-5 shrink-0 text-white/70" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-white">{device(tv.deviceLabel)}</span>
                      {tv.profileName && <span className="block text-[13px] text-white/55">{t('tvSend.profile', { name: tv.profileName })}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Button asChild variant="secondary" onClick={() => setOpen(null)}><Link href="/activate">{t('tvSend.howTo')}</Link></Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
