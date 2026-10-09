"use client"
// /notifications: the whole inbox. All / Friends / Alerts / Movie nights (one at a time; Kids get
// no filters, their inbox is only release alerts), older rows on demand, and what is shown here
// is marked read (the red dots stay for this visit, so you can see what was new).
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bell, RotateCw } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { InboxList } from '@/src/components/inbox/InboxList'
import { EmptyState } from '@/src/components/MediaGrid'
import { Button } from '@/src/components/ui/button'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import type { TKey } from '@/src/lib/i18n'
import type { NotificationItem } from '@/src/lib/models/Follow'
import { NOTIFICATION_FILTERS } from '@/src/lib/social/types'

type Filter = 'all' | keyof typeof NOTIFICATION_FILTERS

const FILTERS: { value: Filter; label: TKey }[] = [
  { value: 'all', label: 'social.notifications.all' },
  { value: 'friends', label: 'social.nav' },
  { value: 'alerts', label: 'social.notifications.alerts' },
  { value: 'nights', label: 'social.push.nightsLabel' },
]

const PAGE = 20

const asFilter = (value: string | null): Filter => (value && value in NOTIFICATION_FILTERS ? value as Filter : 'all')

export default function NotificationsView({ kids }: { kids: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filter: Filter = kids ? 'all' : asFilter(params.get('filter'))
  const [items, setItems] = useState<NotificationItem[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'idle' | 'error' | 'more'>('loading')
  const [digestHint, setDigestHint] = useState(false)
  // Answers that arrive after the filter changed are dropped.
  const request = useRef(0)

  const markRead = (rows: NotificationItem[]) => {
    const ids = rows.filter((item) => !item.read).map((item) => item.id)
    if (ids.length === 0) return
    void fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
      // The bell reloads when the window regains focus: say so, so its badge clears too.
      .then(() => window.dispatchEvent(new Event('focus')))
      .catch(() => undefined)
  }

  const load = useCallback(async (before: string | null) => {
    const attempt = ++request.current
    setStatus(before ? 'more' : 'loading')
    try {
      const query = new URLSearchParams({ limit: String(PAGE), filter, ...(before ? { before } : {}) })
      const response = await fetch(`/api/notifications?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      if (attempt !== request.current) return
      const rows: NotificationItem[] = Array.isArray(data.items) ? data.items : []
      setItems((current) => {
        if (!before) return rows
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...rows.filter((item) => !seen.has(item.id))]
      })
      setNext(data.next ?? null)
      setStatus('idle')
      markRead(rows)
    } catch {
      if (attempt === request.current) setStatus('error')
    }
  }, [filter])

  useEffect(() => {
    setItems([])
    setNext(null)
    void load(null)
  }, [load])

  // The weekly-email hint, for grown-ups who could turn it on (as in the bell).
  useEffect(() => {
    if (kids) return
    let cancelled = false
    fetch('/api/digest', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled) setDigestHint(!!data?.available && !data?.enabled) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [kids])

  const choose = (value: Filter) => {
    const query = new URLSearchParams(params.toString())
    if (value === 'all') query.delete('filter')
    else query.set('filter', value)
    const text = query.toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }

  const onChange = (changed: NotificationItem) => setItems((current) => current.map((item) => (item.id === changed.id ? changed : item)))

  const loading = status === 'loading'
  const filtered = filter !== 'all'

  return (
    <div className="page-x">
      <div className="max-w-[760px]">
        {!kids && (
          <div className="mb-6">
            <ChipGroup mode="single" scroll label={t('social.notifications.filters')}>
              {FILTERS.map((option) => (
                <Chip key={option.value} active={option.value === filter} onClick={() => choose(option.value)}>{t(option.label)}</Chip>
              ))}
            </ChipGroup>
          </div>
        )}

        {status === 'error' && items.length === 0 ? (
          <EmptyState
            icon={<Bell aria-hidden className="h-6 w-6" />}
            title={t('social.inbox.loadFailed')}
            action={<Button variant="secondary" onClick={() => void load(null)}><RotateCw aria-hidden className="h-4 w-4" />{t('social.inbox.retry')}</Button>}
          />
        ) : filtered && !loading && items.length === 0 ? (
          <EmptyState icon={<Bell aria-hidden className="h-6 w-6" />} title={t('social.notifications.emptyFilter')} />
        ) : (
          <div className="rounded-[22px] bg-white/[0.04] p-1.5 ring-1 ring-white/[0.07] sm:p-2">
            <InboxList items={items} loading={loading} digestHint={digestHint && !filtered} onChange={onChange} />
          </div>
        )}

        {items.length > 0 && next && (
          <div className="mt-6 flex flex-col items-center gap-2">
            {status === 'error' && <p role="alert" className="text-[13.5px] text-white/60">{t('social.inbox.loadFailed')}</p>}
            <Button variant="secondary" onClick={() => void load(next)} disabled={status === 'more'} aria-busy={status === 'more'}>
              {status === 'more' ? t('common.loading') : t('social.feed.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
