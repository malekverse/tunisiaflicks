"use client"
// /friends: what friends shared lately, in day groups (Today, Yesterday, This week, Earlier),
// never a time. More loads ahead of the reader (and with a button, for keyboards and slow
// networks). The room takes the colour of the row the reader settles on: only once a row has
// stayed in the middle of the screen for 600ms with scrolling stopped, and only that row's
// colour is ever loaded. With less motion, the room is tinted once, from the newest item.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { EyeOff, RotateCw, UserPlus, UsersRound, X } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { EmptyState } from '@/src/components/MediaGrid'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { loadAmbientColor } from '@/src/hooks/use-ambient-color'
import type { TKey } from '@/src/lib/i18n'
import type { ActivityItem } from '@/src/lib/social/activity'
import { useRoom } from '@/src/store/room'
import { appendUnique, groupByDay, tunisToday, type DayGroup } from '@/src/app/friends/_lib/feed'
import ActivityRow from './ActivityRow'

type Feed = { items: ActivityItem[]; next: string | null }

const GROUP_LABEL: Record<DayGroup, TKey> = {
  today: 'social.feed.today',
  yesterday: 'social.feed.yesterday',
  week: 'social.feed.thisWeek',
  earlier: 'social.feed.earlier',
}

const PAGE = 20
const SETTLE_MS = 600
const NUDGE_KEY = 'tf-friends-share-nudge'

/** "Friends can't see what you watch": a slim glass card, with its own X beside the link. */
function PrivacyNudge() {
  const { t } = useI18n()
  const [shown, setShown] = useState(false)
  useEffect(() => {
    try {
      setShown(localStorage.getItem(NUDGE_KEY) !== 'hidden')
    } catch {
      setShown(true)
    }
  }, [])
  if (!shown) return null
  const hide = () => {
    setShown(false)
    try { localStorage.setItem(NUDGE_KEY, 'hidden') } catch { /* private mode: it comes back next time */ }
  }
  return (
    <div className="glass relative flex animate-focus-in flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] py-2.5 pe-14 ps-4 sm:flex-nowrap">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08]"><EyeOff className="h-[17px] w-[17px] text-white/75" /></span>
      <p className="min-w-0 flex-1 text-[14px] text-white/80">{t('social.nudge.text')}</p>
      <Button asChild size="sm" variant="secondary" className="h-9 px-4">
        <Link href="/profile#privacy">{t('social.nudge.action')}</Link>
      </Button>
      <button
        type="button"
        onClick={hide}
        aria-label={t('social.nudge.dismiss')}
        className="pressable absolute end-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-white/60 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div aria-busy className="space-y-3">
      <Skeleton className="h-5 w-24 rounded-full" />
      <div className="divide-y divide-white/[0.06] rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07]">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-4 p-3 sm:gap-5 sm:p-4">
            <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-poster sm:w-[76px]" />
            <div className="flex-1 space-y-2.5"><Skeleton className="h-4 w-4/5 rounded-full" /><Skeleton className="h-3.5 w-1/3 rounded-full" /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FriendsFeed({ initial, today: serverToday, hasFriends, activityPrivate }: {
  /** The first page, rendered on the server (null when it didn't come back in time: loaded here). */
  initial: Feed | null
  /** Today in Tunis as the server saw it (the browser agrees on first render, then keeps it current). */
  today: string
  hasFriends: boolean
  /** The viewer's own watching isn't shared: offer to share it. */
  activityPrivate: boolean
}) {
  const { t } = useI18n()
  const still = useReducedMotion()
  const setBase = useRoom((state) => state.setBase)
  const [items, setItems] = useState<ActivityItem[]>(initial?.items ?? [])
  const [next, setNext] = useState<string | null>(initial?.next ?? null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>(initial ? 'idle' : 'loading')
  const [today, setToday] = useState(serverToday)
  const root = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const lit = useRef<string | null>(null)

  const load = useCallback(async (before: string | null) => {
    if (busy.current) return
    busy.current = true
    setStatus('loading')
    try {
      const query = new URLSearchParams({ limit: String(PAGE), ...(before ? { before } : {}) })
      const response = await fetch(`/api/social/feed?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const page: Feed = await response.json()
      setItems((current) => (before ? appendUnique(current, page.items) : page.items))
      setNext(page.next)
      setStatus('idle')
    } catch {
      setStatus('error')
    } finally {
      busy.current = false
    }
  }, [])

  // The first page didn't make it into the server render: fetch it here.
  useEffect(() => {
    if (!initial) void load(null)
  }, [initial, load])

  // 'Today' moves at midnight (Tunis): keep the headings honest on a page left open.
  useEffect(() => {
    setToday(tunisToday())
    const timer = setInterval(() => setToday(tunisToday()), 60_000)
    return () => clearInterval(timer)
  }, [])

  // More, 600px before the reader gets there.
  useEffect(() => {
    const node = sentinel.current
    if (!node || !next || status !== 'idle') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void load(next)
    }, { rootMargin: '600px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [next, status, load])

  const light = useCallback((poster: string | null | undefined) => {
    if (!poster || lit.current === poster) return
    lit.current = poster
    loadAmbientColor(poster).then((color) => {
      if (lit.current === poster && color) setBase(color)
    })
  }, [setBase])

  // The room light: the newest item to start with; then whichever row the reader settles on.
  useEffect(() => {
    if (items.length === 0) return
    if (!lit.current) light(items[0].media.poster_path)
    if (still) return
    const container = root.current
    if (!container) return
    let centred: Element | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (centred) light(centred.getAttribute('data-poster'))
      }, SETTLE_MS)
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) centred = entry.target
        else if (centred === entry.target) centred = null
      }
      settle()
    }, { rootMargin: '-45% 0px -45% 0px' })
    container.querySelectorAll('[data-activity-row]').forEach((row) => observer.observe(row))
    window.addEventListener('scroll', settle, { passive: true })
    return () => {
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('scroll', settle)
    }
  }, [items, still, light])

  // Leaving the page gives the room back.
  useEffect(() => () => setBase(null), [setBase])

  const groups = groupByDay(items, today)
  const firstLoad = items.length === 0 && status === 'loading'

  return (
    <div ref={root} className="page-x">
      <div className="max-w-[760px] space-y-8 sm:space-y-10">
        {activityPrivate && <PrivacyNudge />}

        {firstLoad && <FeedSkeleton />}

        {items.length === 0 && status === 'error' && (
          <EmptyState
            icon={<UsersRound aria-hidden className="h-6 w-6" />}
            title={t('social.feed.loadFailed')}
            action={<Button variant="secondary" onClick={() => void load(null)}><RotateCw aria-hidden className="h-4 w-4" />{t('social.inbox.retry')}</Button>}
          />
        )}

        {items.length === 0 && status === 'idle' && (hasFriends ? (
          <EmptyState icon={<UsersRound aria-hidden className="h-6 w-6" />} title={t('social.friends.quietTitle')}>
            {t('social.friends.quietText')}
          </EmptyState>
        ) : (
          <EmptyState
            icon={<UsersRound aria-hidden className="h-6 w-6" />}
            title={t('social.friends.emptyTitle')}
            action={<Button asChild size="lg"><Link href="/friends/list#add"><UserPlus aria-hidden className="h-[18px] w-[18px]" />{t('social.picker.addFriend')}</Link></Button>}
          >
            {t('social.friends.emptyText')}
          </EmptyState>
        ))}

        {groups.map(({ group, items: rows }) => (
          <section key={group} aria-labelledby={`feed-${group}`}>
            <h2 id={`feed-${group}`} className="mb-3 font-display text-[19px] font-bold text-white sm:text-[21px]">{t(GROUP_LABEL[group])}</h2>
            <div className="divide-y divide-white/[0.06] rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07]">
              {rows.map((item) => <ActivityRow key={item.id} item={item} />)}
            </div>
          </section>
        ))}

        {items.length > 0 && (
          <div className="flex flex-col items-center gap-3 pb-2 pt-1">
            <div ref={sentinel} aria-hidden className="h-px w-full" />
            {next ? (
              <>
                {status === 'error' && <p role="alert" className="text-[13.5px] text-white/60">{t('social.feed.loadFailed')}</p>}
                <Button variant="secondary" onClick={() => void load(next)} disabled={status === 'loading'} aria-busy={status === 'loading'}>
                  {status === 'loading' ? t('common.loading') : status === 'error' ? t('social.inbox.retry') : t('social.feed.loadMore')}
                </Button>
              </>
            ) : (
              <p className="text-[13px] text-white/50">{t('social.feed.end')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
