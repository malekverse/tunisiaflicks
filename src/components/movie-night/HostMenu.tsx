"use client"
// The night's "…" menu. The host: Edit, Invite friends, Remove a guest, Turn off the link (with how
// much it was used) and Cancel the night (confirmed). A guest: Leave this night (confirmed).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Link2Off, LogOut, MoreHorizontal, Pencil, UserMinus, UserPlus } from 'lucide-react'
import { UserAvatar } from '@/src/components/social/Avatar'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu'
import { toast } from '@/src/hooks/use-toast'
import type { NightView } from '@/src/lib/movie-night'
import type { Act } from './NightView'

type Confirm = null | 'cancel' | 'leave' | 'remove'

export default function HostMenu({ view, act, onInvite }: { view: NightView; act: Act; onInvite: () => void }) {
  const { t, dir } = useI18n()
  const router = useRouter()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const isHost = view.role === 'host'
  const planned = view.status === 'planned'
  const removable = view.guests

  const run = async (action: string, body?: Record<string, unknown>) => {
    setBusy(true)
    const result = await act(action, body)
    setBusy(false)
    return result.ok
  }

  const item = 'min-h-11 gap-3 text-[14.5px]'
  if (!isHost && !planned) return null

  return (
    <>
      <DropdownMenu dir={dir}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="icon-lg" aria-label={t('movieNight.host.menu')} className="shrink-0">
            <MoreHorizontal aria-hidden className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[15rem]">
          {isHost ? (
            <>
              {view.can.edit && (
                <DropdownMenuItem className={item} onSelect={() => router.push(`/movie-night/${view.id}/edit`)}>
                  <Pencil aria-hidden className="h-4 w-4 text-white/70" />{t('movieNight.host.edit')}
                </DropdownMenuItem>
              )}
              {planned && (
                <DropdownMenuItem className={item} onSelect={onInvite}>
                  <UserPlus aria-hidden className="h-4 w-4 text-white/70" />{t('movieNight.host.invite')}
                </DropdownMenuItem>
              )}
              {removable.length > 0 && (
                <DropdownMenuItem className={item} onSelect={() => setConfirm('remove')}>
                  <UserMinus aria-hidden className="h-4 w-4 text-white/70" />{t('movieNight.host.remove')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className={item}
                disabled={!view.link || view.link.maxUses === 0}
                onSelect={async () => {
                  if (await run('linkOff')) {
                    try { localStorage.removeItem(`tf-night-link:${view.id}`) } catch { /* nothing kept */ }
                    toast({ title: t('movieNight.host.linkOffDone') })
                  }
                }}
              >
                <Link2Off aria-hidden className="h-4 w-4 text-white/70" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{t('movieNight.host.linkOff')}</span>
                  <span className="text-[12px] text-white/55">
                    {view.link && view.link.maxUses > 0 ? t('movieNight.page.linkUses', { uses: view.link.uses, maxUses: view.link.maxUses }) : t('movieNight.page.linkOff')}
                  </span>
                </span>
              </DropdownMenuItem>
              {planned && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className={`${item} text-red-300 focus:text-red-200`} onSelect={() => setConfirm('cancel')}>
                    <Ban aria-hidden className="h-4 w-4" />{t('movieNight.host.cancel')}
                  </DropdownMenuItem>
                </>
              )}
            </>
          ) : (
            <>
              <DropdownMenuLabel className="sr-only">{t('movieNight.host.menu')}</DropdownMenuLabel>
              <DropdownMenuItem className={item} onSelect={() => setConfirm('leave')}>
                <LogOut aria-hidden className="h-4 w-4 text-white/70 rtl:-scale-x-100" />{t('movieNight.leave')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirm === 'cancel' || confirm === 'leave'} onOpenChange={(open) => { if (!open) setConfirm(null) }}>
        <DialogContent className="max-w-[420px] p-6">
          <DialogTitle className="font-display text-[22px] font-bold">{confirm === 'leave' ? t('movieNight.leave.title') : t('movieNight.cancel.title')}</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-white/65">{confirm === 'leave' ? t('movieNight.leave.text') : t('movieNight.cancel.text')}</DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>{confirm === 'leave' ? t('common.cancel') : t('movieNight.cancel.keep')}</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const leaving = confirm === 'leave'
                const ok = await run(leaving ? 'leave' : 'cancel')
                setConfirm(null)
                if (ok && leaving) {
                  toast({ title: t('movieNight.leave.done') })
                  router.push('/movie-night')
                }
              }}
            >
              {confirm === 'leave' ? t('movieNight.leave.confirm') : t('movieNight.cancel.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === 'remove'} onOpenChange={(open) => { if (!open) setConfirm(null) }}>
        <DialogContent className="max-w-[440px] p-6">
          <DialogTitle className="font-display text-[22px] font-bold">{t('movieNight.remove.title')}</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed text-white/65">{t('movieNight.remove.text')}</DialogDescription>
          <ul className="no-scrollbar mt-4 max-h-[50dvh] space-y-1 overflow-y-auto overscroll-contain">
            {removable.map((guest) => (
              <li key={guest.profileId} className="flex min-h-[52px] items-center gap-3 rounded-xl px-1">
                <UserAvatar person={guest} size={32} />
                <span className="min-w-0 flex-1">
                  <bdi className="block truncate text-[14.5px] text-white">{guest.name}</bdi>
                  <span className="text-[12.5px] text-white/55">{t(`movieNight.status.${guest.status}`)}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={t('movieNight.remove.action', { name: guest.name })}
                  className="h-11 px-4 text-[14px] ring-1 ring-inset ring-white/[0.12]"
                  onClick={async () => {
                    if (await run('remove', { profileId: guest.profileId })) toast({ title: t('movieNight.remove.done', { name: guest.name }) })
                  }}
                >
                  <UserMinus aria-hidden className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
