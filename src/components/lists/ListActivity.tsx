"use client"
// What other people do in a list: the one line that tells you what just happened (it changes as
// it happens, quietly announced), and "Recent changes", where a removed title can be put back.
import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronDown, Undo2 } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { UserAvatar } from '@/src/components/social/Avatar'
import LiveDot from '@/src/components/ui/live-dot'
import { timeAgo } from '@/src/components/inbox/InboxItem'
import type { TKey, Translate } from '@/src/lib/i18n'
import { richT } from '@/src/lib/i18n/rich'
import { spring, tween } from '@/src/lib/motion'
import { itemKey } from '@/src/lib/shared-lists/rules'
import type { SharedListActivity, SharedListView } from '@/src/lib/shared-lists/types'
import { UNKNOWN } from './people'

function keyFor(entry: SharedListActivity): TKey {
  switch (entry.kind) {
    case 'add': return 'sharedLists.live.add'
    case 'remove': return 'sharedLists.live.remove'
    case 'move': return entry.item ? 'sharedLists.live.move' : 'sharedLists.live.order'
    case 'title': return 'sharedLists.live.title'
    case 'description': return 'sharedLists.live.description'
    case 'join': return 'sharedLists.live.join'
    case 'leave': return entry.value === 'removed' ? 'sharedLists.live.removed' : 'sharedLists.live.leave'
    case 'visibility': return 'sharedLists.live.visibility'
    default: return 'sharedLists.live.owner'
  }
}

/** One change as a sentence: the person's name in bold, the title isolated. */
export function activitySentence(t: Translate, entry: SharedListActivity, list: Pick<SharedListView, 'people'>) {
  const person = (entry.by && list.people[entry.by]) || UNKNOWN
  const vars = { name: person.name, title: entry.item?.title ?? '' }
  return { node: richT(t, keyFor(entry), vars, { bold: ['name'] }), text: t(keyFor(entry), vars), person }
}

/** "Sami added Dune, just now": the latest thing someone else did. Live while the page is open. */
export function LiveActivityLine({ entry, list, live }: { entry: SharedListActivity | null; list: SharedListView; live: boolean }) {
  const { t, dateLocale } = useI18n()
  // The relative time moves on by itself.
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div aria-live="polite" aria-atomic="true" className="min-h-[1px]">
      <AnimatePresence mode="popLayout" initial={false}>
        {entry && (() => {
          const { node, person } = activitySentence(t, entry, list)
          return (
            <m.p
              key={entry.id}
              initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: spring.ui }}
              exit={{ opacity: 0, transition: tween.fast }}
              className="flex min-w-0 items-center gap-2.5 text-[14px] text-white/70"
            >
              {live && <LiveDot label="" className="shrink-0" />}
              <UserAvatar person={person} size={24} />
              <span className="min-w-0 truncate">{node}</span>
              <span suppressHydrationWarning className="shrink-0 text-[13px] text-white/50">{timeAgo(entry.at, dateLocale)}</span>
            </m.p>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}

const FIRST = 8

/** The latest changes, newest first. A title someone removed (and nobody put back) can come back. */
export function RecentChanges({ list, onPutBack, disabled }: { list: SharedListView; onPutBack: (entry: SharedListActivity) => void; disabled?: boolean }) {
  const { t, dateLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  if (list.activity.length === 0) return null
  const present = new Set(list.items.map(itemKey))
  const shown = all ? list.activity : list.activity.slice(0, FIRST)
  const panel = `recent-${list.slug}`
  return (
    <section className="rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07]">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen((value) => !value)}
          className="pressable flex min-h-[56px] w-full items-center justify-between gap-4 rounded-[22px] px-5 text-start outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-red-500 sm:px-6"
        >
          <span className="flex items-baseline gap-3">
            <span className="font-display text-[19px] font-bold text-white sm:text-[21px]">{t('sharedLists.recent.title')}</span>
            <span className="text-[13px] tabular-nums text-white/50">{list.activity.length}</span>
          </span>
          <ChevronDown aria-hidden className={`h-5 w-5 text-white/60 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: spring.ui }}
            exit={{ height: 0, opacity: 0, transition: tween.fast }}
            className="overflow-hidden"
          >
            <ol className="space-y-0.5 px-3 pb-3 sm:px-4 sm:pb-4">
              {shown.map((entry) => {
                const { node, person } = activitySentence(t, entry, list)
                const canPutBack = entry.kind === 'remove' && entry.item && !present.has(itemKey(entry.item))
                return (
                  <li key={entry.id} className="flex min-h-[52px] items-center gap-3 rounded-2xl px-2 py-1.5">
                    <UserAvatar person={person} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[14px] leading-snug text-white/75">{node}</span>
                      <span suppressHydrationWarning className="mt-0.5 block text-[12.5px] text-white/50">{timeAgo(entry.at, dateLocale)}</span>
                    </span>
                    {canPutBack && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onPutBack(entry)}
                        aria-label={t('sharedLists.recent.putBackAria', { title: entry.item!.title })}
                        className="pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-4 text-[13.5px] font-medium text-white outline-none ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
                      >
                        <Undo2 aria-hidden className="h-4 w-4 rtl:-scale-x-100" />{t('sharedLists.recent.putBack')}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
            {!all && list.activity.length > FIRST && (
              <div className="px-5 pb-4 sm:px-6">
                <button type="button" onClick={() => setAll(true)} className="pressable h-11 rounded-full px-1 text-[13.5px] font-medium text-white/70 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
                  {t('common.seeAll')}
                </button>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}
