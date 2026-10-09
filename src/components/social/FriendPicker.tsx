"use client"
// Pick friends to send something to: a row of avatars to toggle (a red ring and a check mark the
// picked ones), a search field once there are more than 8 friends, and at most `max` picks (one
// more makes the row shake and says why).
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { m, useAnimationControls } from 'framer-motion'
import { Check, Search, UserPlus } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Skeleton } from '@/src/components/ui/skeleton'
import { haptic } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { PublicIdentity } from '@/src/lib/social/types'
import { UserAvatar } from './Avatar'

type Friend = { person: PublicIdentity }

let cache: { at: number; friends: PublicIdentity[] } | null = null

async function loadFriends(): Promise<PublicIdentity[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.friends
  const response = await fetch('/api/social/friends', { cache: 'no-store' })
  if (!response.ok) throw new Error(String(response.status))
  const body = await response.json()
  const friends = (Array.isArray(body.friends) ? body.friends : []).map((friend: Friend) => friend.person)
  cache = { at: Date.now(), friends }
  return friends
}

export default function FriendPicker({ selected, onChange, max = 5, disabledHandles = [] }: { selected: string[]; onChange: (handles: string[]) => void; max?: number; disabledHandles?: string[] }): JSX.Element {
  const t = useT()
  const [friends, setFriends] = useState<PublicIdentity[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [limitNote, setLimitNote] = useState(false)
  const shake = useAnimationControls()

  const load = () => {
    setFailed(false)
    loadFriends().then(setFriends).catch(() => setFailed(true))
  }
  useEffect(load, [])

  const shown = useMemo(() => {
    if (!friends) return []
    const q = query.trim().toLowerCase().replace(/^@/, '')
    if (!q) return friends
    return friends.filter((friend) => friend.name.toLowerCase().includes(q) || friend.handle.includes(q))
  }, [friends, query])

  const toggle = (handle: string) => {
    if (selected.includes(handle)) {
      setLimitNote(false)
      onChange(selected.filter((item) => item !== handle))
      return
    }
    if (selected.length >= max) {
      setLimitNote(true)
      haptic(20)
      shake.start({ x: [0, -7, 7, -5, 5, -2, 0], transition: { duration: 0.4, ease: 'easeOut' } })
      return
    }
    haptic(8)
    onChange([...selected, handle])
  }

  if (failed) {
    return (
      <p className="flex items-center gap-3 text-[14px] text-white/60">
        {t('social.picker.loadFailed')}
        <button type="button" onClick={load} className="h-11 rounded-full px-3 font-medium text-white underline-offset-4 hover:underline">{t('social.picker.retry')}</button>
      </p>
    )
  }

  if (!friends) {
    return (
      <div aria-busy className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex w-[68px] shrink-0 flex-col items-center gap-2">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-3 w-12 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (friends.length === 0) {
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/[0.06]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><UserPlus aria-hidden className="h-5 w-5 text-white/70" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-medium">{t('social.picker.empty')}</p>
          <p className="text-[13px] text-white/55">{t('social.picker.emptyText')}</p>
        </div>
        <Link href="/friends/list#add" className="pressable inline-flex h-11 shrink-0 items-center rounded-full bg-white/[0.1] px-4 text-[13.5px] font-medium outline-none hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-red-500">
          {t('social.picker.addFriend')}
        </Link>
      </div>
    )
  }

  return (
    <div>
      {friends.length > 8 && (
        <label className="relative mb-3 block">
          <span className="sr-only">{t('social.picker.search')}</span>
          <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('social.picker.search')}
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-full border border-white/10 bg-white/[0.05] pe-4 ps-11 text-[16px] text-white outline-none transition-[border-color,background-color] placeholder:text-white/45 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07]"
          />
        </label>
      )}
      <m.ul animate={shake} aria-label={t('social.picker.label')} className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 pt-1">
        {shown.map((friend) => {
          const picked = selected.includes(friend.handle)
          const off = disabledHandles.includes(friend.handle)
          return (
            <li key={friend.handle} className="shrink-0">
              <button
                type="button"
                aria-pressed={picked}
                disabled={off}
                onClick={() => toggle(friend.handle)}
                className="group flex w-[72px] select-none flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 outline-none [touch-action:manipulation] focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
              >
                <span className="relative transition-transform duration-100 ease-out group-active:scale-95">
                  <UserAvatar person={friend} size={56} className={cn('ring-2 ring-offset-2 ring-offset-[#0e0e10] transition-[box-shadow] duration-150', picked ? 'ring-red-500' : 'ring-transparent')} />
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -bottom-0.5 -end-0.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white ring-2 ring-[#0e0e10] transition-[opacity,transform] duration-150 ease-out',
                      picked ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </span>
                <bdi className={cn('w-full truncate text-center text-[12px] leading-tight', picked ? 'font-medium text-white' : 'text-white/70')}>{friend.name}</bdi>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && (
          <li className="py-4 text-[13.5px] text-white/55">{t('social.picker.noMatch', { query: query.trim() })}</li>
        )}
      </m.ul>
      <p aria-live="polite" className={cn('mt-1 text-[12.5px]', limitNote ? 'text-white/75' : 'text-white/50')}>
        {limitNote ? t('social.picker.max', { max }) : selected.length > 0 ? t('social.picker.selected', { count: selected.length, max }) : ' '}
      </p>
    </div>
  )
}
