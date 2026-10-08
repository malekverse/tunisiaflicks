"use client"
// The inbox is the bell: a popover on desktop, a bottom sheet on phones, with the same rows.
// Release alerts, friends, sent titles, invitations: rows waiting for an answer stay on top until
// answered. Opening it clears the badge. Nothing for guests.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Bell } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/src/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { useMediaQuery } from '@/src/hooks/use-media-query'
import { useProfiles } from '@/src/hooks/use-profiles'
import { RELEASE_KINDS, type NotificationItem } from '@/src/lib/models/Follow'
import { cn } from '@/src/lib/utils'
import { InboxTouchContext } from './InboxItem'
import { InboxList } from './InboxList'

/** lg and up: the popover; below it, the bottom sheet (same breakpoint as the rail and tab bar). */
const DESKTOP = '(min-width: 1024px)'

export default function InboxBell(): JSX.Element | null {
  const t = useT()
  const pathname = usePathname()
  const { data: session } = useSession()
  const userId = session?.user?.id
  const { active } = useProfiles()
  const kids = !!active?.kids
  const activeId = active?.id
  const desktop = useMediaQuery(DESKTOP)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [digestHint, setDigestHint] = useState(false)
  // Bumped whenever local state changes, so a response that started before it is dropped.
  const version = useRef(0)
  const markingRead = useRef<Promise<unknown> | null>(null)

  const refresh = useCallback(async () => {
    try {
      await markingRead.current
      const requested = version.current
      const response = await fetch('/api/notifications?limit=20', { cache: 'no-store' })
      if (requested !== version.current) return
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      if (requested !== version.current) return
      setItems(Array.isArray(data.items) ? data.items : [])
      setUnread(data.unread || 0)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Alerts arrive a few times a day: on sign-in, on a profile switch, when the tab comes back.
  useEffect(() => {
    if (!userId) return
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [userId, activeId, refresh])

  // The weekly-email hint, once, for grown-ups who could turn it on.
  useEffect(() => {
    if (!userId || !activeId || kids) return setDigestHint(false)
    let cancelled = false
    fetch('/api/digest', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled) setDigestHint(!!data?.available && !data?.enabled) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [userId, activeId, kids])

  // A link inside it was followed: put it away.
  useEffect(() => { setOpen(false) }, [pathname])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    refresh()
    if (unread === 0) return
    version.current++
    setUnread(0)
    markingRead.current = fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
      .catch(() => undefined)
      .finally(() => { markingRead.current = null })
  }

  const onChange = (changed: NotificationItem) => {
    version.current++
    setItems((current) => current.map((item) => (item.id === changed.id ? changed : item)))
  }

  if (!userId) return null

  const label = unread > 0 ? t('alerts.bellLabelUnread', { count: unread }) : t('alerts.bellLabel')
  const releaseOnly = kids || items.every((item) => RELEASE_KINDS.includes(item.kind))
  const manageHref = releaseOnly ? '/profile#following' : '/profile#notifications'

  const trigger = (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={desktop ? undefined : () => onOpenChange(true)}
      className={cn(
        'pressable relative grid h-10 w-10 place-items-center rounded-full text-white/75 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500',
        open && 'bg-white/[0.1] text-white',
      )}
    >
      <Bell aria-hidden className="h-[21px] w-[21px]" strokeWidth={1.9} />
      {unread > 0 && (
        <span aria-hidden className="absolute end-1 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-black">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )

  const list = failed && items.length === 0
    ? (
      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
        <p className="text-[14px] text-white/60">{t('social.inbox.loadFailed')}</p>
        <button type="button" onClick={() => { setLoading(true); refresh() }} className="h-11 rounded-full bg-white/[0.08] px-5 text-[14px] font-medium outline-none hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-red-500">
          {t('social.inbox.retry')}
        </button>
      </div>
    )
    : <InboxList items={items} loading={loading} digestHint={digestHint} onChange={onChange} />

  const footer = (
    <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-2 py-2">
      <Link href="/notifications" onClick={() => setOpen(false)} className="inline-flex h-11 items-center rounded-full px-4 text-[14px] font-medium text-white outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500">
        {t('social.inbox.seeAll')}
      </Link>
      <Link href={manageHref} onClick={() => setOpen(false)} className="inline-flex h-11 items-center rounded-full px-4 text-[14px] text-white/65 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
        {t('social.inbox.manage')}
      </Link>
    </div>
  )

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} aria-label={t('alerts.bellLabel')} className="flex max-h-[min(560px,calc(100dvh-96px))] w-[360px] flex-col p-0">
          <p className="px-4 pb-2 pt-4 text-[15px] font-semibold">{t('alerts.bellLabel')}</p>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">{list}</div>
          {footer}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerTitle className="px-5 pb-1 pt-3 text-[17px] font-semibold">{t('alerts.bellLabel')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t(kids ? 'social.inbox.emptyTextKids' : 'social.inbox.emptyText')}</DrawerDescription>
          <InboxTouchContext.Provider value>
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-1">{list}</div>
          </InboxTouchContext.Provider>
          {footer}
        </DrawerContent>
      </Drawer>
    </>
  )
}
