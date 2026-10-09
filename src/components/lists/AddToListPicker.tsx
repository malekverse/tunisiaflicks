"use client"
// The one "Add to a list" picker (in the ShareSheet and in its own sheet): every list the viewer
// can add to (theirs and the ones they help build), with a check where the title already is, and
// "New list…" to start one with this title in it. A tap adds, says so, and closes what holds it.
import { useId, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, ListVideo, Loader2, Plus } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import TmdbImage from '@/src/components/TmdbImage'
import { AvatarStack } from '@/src/components/social/Avatar'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useMyLists } from '@/src/hooks/use-my-lists'
import { toast } from '@/src/hooks/use-toast'
import { haptic, spring, tween } from '@/src/lib/motion'
import { itemKey } from '@/src/lib/shared-lists/rules'
import type { ShareMedia } from '@/src/lib/social/types'
import type { MyListSummary, SharedListView } from '@/src/lib/shared-lists/types'
import { cn } from '@/src/lib/utils'
import { listErrorText, listFetch } from './list-client'

const ROW = 'flex min-h-[64px] w-full items-center gap-3.5 rounded-2xl px-3 py-2 text-start outline-none transition-colors duration-150'

function Thumb({ list }: { list: MyListSummary }) {
  const poster = list.posters.find(Boolean) ?? null
  return (
    <span className="relative grid h-[54px] w-9 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-white/[0.06] ring-1 ring-inset ring-white/10">
      {poster ? <TmdbImage kind="poster" path={poster} alt="" fill sizes="36px" className="object-cover" /> : <ListVideo aria-hidden className="h-4 w-4 text-white/50" />}
    </span>
  )
}

export default function AddToListPicker({ media, onDone, className }: { media: ShareMedia; onDone: () => void; className?: string }) {
  const t = useT()
  const key = itemKey(media)
  const mine = useMyLists({ contains: key })
  const [adding, setAdding] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('')
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)

  const lists = mine.data?.lists ?? []
  const busy = !!adding || creating

  const add = async (list: MyListSummary) => {
    if (busy || list.contains) return
    setAdding(list.slug)
    try {
      await listFetch(`/api/lists/${encodeURIComponent(list.slug)}`, { method: 'PATCH', body: { add: { media_type: media.media_type, id: media.id } } })
      haptic(10)
      toast({ title: t('sharedLists.add.added', { list: list.title }), description: media.title, duration: 2500 })
      onDone()
    } catch (error) {
      toast({ variant: 'destructive', title: t('sharedLists.add.failed'), description: listErrorText(t, error) })
      setAdding(null)
    }
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    const title = name.trim()
    if (!title || busy) return
    setCreating(true)
    try {
      const data = await listFetch<{ list: SharedListView }>('/api/lists', { method: 'POST', body: { title, item: media } })
      haptic(10)
      toast({ title: t('sharedLists.add.added', { list: data?.list.title ?? title }), description: media.title, duration: 2500 })
      onDone()
    } catch (error) {
      toast({ variant: 'destructive', title: t('library.createFailed'), description: listErrorText(t, error) })
      setCreating(false)
    }
  }

  const openNew = () => {
    setNewOpen(true)
    // After the field is in the page.
    requestAnimationFrame(() => input.current?.focus())
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {mine.status === 'loading' && !mine.data && (
        <div aria-busy className="space-y-0.5" role="status">
          <span className="sr-only">{t('library.loadingLists')}</span>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={cn(ROW, 'pointer-events-none')}>
              <Skeleton className="h-[54px] w-9 rounded-[6px]" />
              <span className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3 rounded-full" /><Skeleton className="h-3 w-1/4 rounded-full" /></span>
            </div>
          ))}
        </div>
      )}

      {mine.status === 'error' && !mine.data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
          <p role="alert" className="text-[14px] text-white/70">{t('sharedLists.add.loadFailed')}</p>
          <Button size="sm" variant="secondary" className="h-11 px-4" onClick={() => mine.reload()}>{t('sharedLists.add.retry')}</Button>
        </div>
      )}

      {mine.data && lists.length === 0 && !newOpen && <p className="px-3 pb-1 text-[14px] text-white/60">{t('sharedLists.add.empty')}</p>}

      {mine.data && lists.length > 0 && (
        <ul className="no-scrollbar max-h-[min(50dvh,420px)] space-y-0.5 overflow-y-auto overscroll-contain">
          {lists.map((list) => {
            const there = !!list.contains
            const loading = adding === list.slug
            return (
              <li key={list.slug}>
                <button
                  type="button"
                  onClick={() => add(list)}
                  disabled={busy && !loading}
                  aria-disabled={there || undefined}
                  className={cn(ROW, there ? 'cursor-default' : 'pressable hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500', busy && !loading && 'opacity-60')}
                >
                  <Thumb list={list} />
                  <span className="min-w-0 flex-1">
                    <bdi className="block truncate text-[15px] font-medium text-white">{list.title}</bdi>
                    <span className="mt-1 flex items-center gap-2 text-[13px] text-white/55">
                      {list.memberCount > 1 && <AvatarStack people={list.members} total={list.memberCount} size={24} />}
                      <span className="truncate">{there ? t('sharedLists.add.inList') : list.count === 1 ? t('library.countOne') : t('library.count', { count: list.count })}</span>
                    </span>
                  </span>
                  <span aria-hidden className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', there ? 'bg-white text-black' : 'bg-white/[0.08] text-white/80')}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : there ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Plus className="h-4 w-4" strokeWidth={2.4} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {mine.data && (
        <AnimatePresence initial={false} mode="popLayout">
          {newOpen || lists.length === 0 ? (
            <m.form
              key="form"
              onSubmit={create}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: spring.ui }}
              exit={{ opacity: 0, transition: tween.fast }}
              className="flex items-center gap-2 px-1 pt-2"
            >
              <label htmlFor={inputId} className="sr-only">{t('sharedLists.add.newListLabel')}</label>
              <input
                ref={input}
                id={inputId}
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 80))}
                maxLength={80}
                dir="auto"
                autoComplete="off"
                enterKeyHint="done"
                placeholder={t('library.listTitlePlaceholder')}
                className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-4 text-[16px] text-white outline-none transition-[border-color,background-color] duration-200 placeholder:text-white/45 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07] sm:text-[15px]"
              />
              <Button type="submit" className="h-11 shrink-0 px-5" disabled={!name.trim() || busy}>
                {creating ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Plus aria-hidden className="h-4 w-4" strokeWidth={2.4} />}
                {t('sharedLists.add.create')}
              </Button>
            </m.form>
          ) : (
            <m.button
              key="new"
              type="button"
              onClick={openNew}
              exit={{ opacity: 0, transition: tween.fast }}
              className={cn(ROW, 'pressable min-h-[56px] text-white/85 hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500')}
            >
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-white/25 text-white/80"><Plus className="h-4 w-4" /></span>
              <span className="text-[15px] font-medium">{t('sharedLists.add.newList')}</span>
            </m.button>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
