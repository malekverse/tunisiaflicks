"use client"
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, ListVideo, Lock, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import PosterCard from '@/src/components/PosterCard'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { CardAction } from '@/src/components/library/controls'
import ListDetailsFields from '@/src/components/library/ListDetailsForm'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { haptic, spring, tween } from '@/src/lib/motion'
import { searchMovies } from '@/src/app/search/actions'
import { getFavorites, getWatchHistory } from '@/src/lib/user-content'
import type { PublicList } from '@/src/lib/lists-db'

type Item = PublicList['items'][number]
type Candidate = { id: string, media_type: 'movie' | 'tv', title: string, poster_path: string | null, year?: string }

const keyOf = (item: { media_type: string, id: string | number }) => `${item.media_type}-${item.id}`
const routeOf = (item: Item) => `/${item.media_type}/${item.id}`

/** Owner view of a list: edit details, add/remove/reorder titles, delete. */
export default function ListEditor({ initial }: { initial: PublicList }) {
  const router = useRouter()
  const t = useT()
  const [list, setList] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<Candidate[]>([])

  const inList = useMemo(() => new Set(list.items.map(keyOf)), [list.items])

  /** Sends a change; `before` is the list to go back to if it fails (optimistic changes). */
  const patch = async (body: object, success?: string, before?: PublicList) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/lists/${list.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('lists.updateFailed'))
      setList(data.list)
      if (success) toast({ title: success, duration: 2000 })
      router.refresh() // keep the server-rendered parts (share card, counts) in sync
      return true
    } catch (error: any) {
      if (before) setList(before)
      toast({ variant: 'destructive', title: t('common.error'), description: error.message })
      return false
    } finally {
      setSaving(false)
    }
  }

  const add = (candidate: Candidate) => {
    haptic(8)
    return patch({ add: candidate }, t('lists.addedTitle', { title: candidate.title }))
  }
  // Removing and reordering show right away; the server's answer confirms (or undoes) them.
  const remove = (item: Item) => {
    const before = list
    setList({ ...list, items: list.items.filter((other) => keyOf(other) !== keyOf(item)) })
    patch({ remove: { id: item.id, media_type: item.media_type } }, undefined, before)
  }
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= list.items.length) return
    const before = list
    const items = list.items.slice()
    ;[items[index], items[target]] = [items[target], items[index]]
    setList({ ...list, items })
    patch({ order: items.map(keyOf) }, undefined, before)
  }

  // Search TMDB (debounced) for titles to add.
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    let cancelled = false
    setSearching(true)
    const timeout = setTimeout(async () => {
      try {
        const data: any = await searchMovies(q, false, 1)
        if (cancelled) return
        setResults((data.results ?? [])
          .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
          .slice(0, 8)
          .map((item: any) => ({
            id: String(item.id),
            media_type: item.media_type,
            title: item.title || item.name,
            poster_path: item.poster_path ?? null,
            year: (item.release_date || item.first_air_date || '').slice(0, 4),
          })))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [query])

  // One-tap suggestions from the user's favorites and watch history.
  useEffect(() => {
    Promise.all([getFavorites(), getWatchHistory()]).then(([favorites, history]) => {
      const seen = new Set<string>()
      const merged: Candidate[] = []
      for (const item of [...favorites, ...history]) {
        const key = keyOf(item)
        if (seen.has(key) || !item.poster_path || (item.media_type !== 'movie' && item.media_type !== 'tv')) continue
        seen.add(key)
        merged.push({ id: String(item.id), media_type: item.media_type, title: item.title, poster_path: item.poster_path })
      }
      setSuggestions(merged.slice(0, 18))
    })
  }, [])

  const openEditor = () => {
    setTitle(list.title)
    setDescription(list.description)
    setEditing(true)
  }

  const saveDetails = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    if (await patch({ title, description }, t('lists.updated'))) setEditing(false)
  }

  const deleteList = async () => {
    setDeleting(true)
    const res = await fetch(`/api/lists/${list.slug}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) {
      toast({ title: t('lists.deleted'), duration: 2000 })
      router.push('/lists')
    } else {
      setDeleting(false)
      toast({ variant: 'destructive', title: t('common.error'), description: t('lists.deleteFailed') })
    }
  }

  const freshSuggestions = suggestions.filter((item) => !inList.has(keyOf(item)))
  const count = list.items.length

  return (
    <div className="space-y-12">
      {/* Owner bar */}
      <section className="flex flex-col gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="flex items-start gap-3 text-[14px] leading-snug text-white/70">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07]"><Lock aria-hidden className="h-4 w-4 text-white/80" /></span>
          <span className="self-center">{t('lists.ownerNote')}</span>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={openEditor}><Pencil aria-hidden className="h-4 w-4" />{t('lists.editDetails')}</Button>
          <Button variant="destructive" onClick={() => setConfirmingDelete(true)}><Trash2 aria-hidden className="h-4 w-4" />{t('lists.deleteList')}</Button>
        </div>
      </section>

      {/* Add titles */}
      <section className="space-y-4">
        <h2 className="font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">{t('lists.addTitles')}</h2>
        <div className="relative max-w-xl">
          <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('lists.searchPlaceholder')}
            aria-label={t('lists.searchAria')}
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 rounded-full ps-11 text-base sm:text-[15px]"
          />
        </div>
        {query.trim() && (
          <ul aria-live="polite" className="max-w-xl overflow-hidden rounded-[22px] bg-white/[0.04] p-1.5 ring-1 ring-white/[0.07]">
            {searching && results.length === 0 && <li className="px-4 py-3 text-sm text-white/55">{t('lists.searching')}</li>}
            {!searching && results.length === 0 && <li className="px-4 py-3 text-sm text-white/55">{t('lists.noResults')}</li>}
            {results.map((item) => {
              const added = inList.has(keyOf(item))
              return (
                <li key={keyOf(item)} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white/[0.04]">
                  <span className="relative block h-[60px] w-10 shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
                    <TmdbImage kind="poster" path={item.poster_path} alt="" fill sizes="40px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium text-white"><bdi>{item.title}</bdi></p>
                    <p className="mt-0.5 flex gap-x-2.5 text-[12.5px] text-white/50">
                      <span>{t(item.media_type === 'tv' ? 'common.tvShow' : 'common.movie')}</span>
                      {item.year && <span>{item.year}</span>}
                    </p>
                  </div>
                  {added ? (
                    <span className="inline-flex h-8 items-center gap-1.5 px-3 text-[13px] font-medium text-white/55">
                      <Check aria-hidden className="h-4 w-4 text-red-400" strokeWidth={2.4} />{t('lists.addedShort')}
                    </span>
                  ) : (
                    <Button size="sm" variant="white" disabled={saving} onClick={() => add(item)} aria-label={t('lists.addTitle', { title: item.title })}>
                      <Plus aria-hidden className="h-4 w-4" strokeWidth={2.4} />{t('lists.add')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {freshSuggestions.length > 0 && (
          <div>
            <p className="mb-3 text-[13px] text-white/55">{t('lists.suggestions')}</p>
            <div className="no-scrollbar -mx-[var(--gutter)] flex gap-2.5 overflow-x-auto overscroll-x-contain px-[var(--gutter)] pb-1">
              {freshSuggestions.map((item) => (
                <button
                  key={keyOf(item)}
                  type="button"
                  disabled={saving}
                  onClick={() => add(item)}
                  aria-label={t('lists.addTitle', { title: item.title })}
                  title={t('lists.addTitle', { title: item.title })}
                  className="group/sug relative w-[76px] shrink-0 select-none overflow-hidden rounded-poster outline-none transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 sm:w-[84px]"
                >
                  <span className="relative block aspect-[2/3] w-full bg-white/[0.06]">
                    <TmdbImage kind="poster" path={item.poster_path} alt="" fill sizes="84px" className="object-cover transition-[filter] duration-200 group-hover/sug:brightness-75" />
                  </span>
                  <span aria-hidden className="glass absolute bottom-1.5 end-1.5 grid h-6 w-6 place-items-center rounded-full text-white transition-transform duration-200 ease-out group-hover/sug:scale-110">
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Items */}
      <section>
        <h2 className="mb-5 flex items-baseline gap-3 font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">
          {t('lists.inThisList')}
          <span className="font-sans text-[14px] font-normal text-white/45">{count === 1 ? t('library.countOne') : t('library.count', { count })}</span>
        </h2>
        {count === 0 ? (
          <EmptyState icon={<ListVideo aria-hidden className="h-6 w-6" />} title={t('library.emptyList')}>
            <p>{t('lists.emptyOwner')}</p>
          </EmptyState>
        ) : (
          <ol className={`${GRID_CLASS} relative`}>
            <AnimatePresence mode="popLayout" initial={false}>
              {list.items.map((item, index) => (
                <m.li
                  key={keyOf(item)}
                  layout="position"
                  transition={spring.ui}
                  exit={{ opacity: 0, scale: 0.92, transition: tween.fast }}
                  className="group/item relative"
                >
                  <div className="relative">
                    <PosterCard
                      bare
                      posterImg={item.poster_path}
                      title={item.title}
                      mediaType={item.media_type}
                      link={routeOf(item)}
                      actions={false}
                      overlay={<span aria-label={t('home.rank', { rank: index + 1 })} className="glass absolute start-2 top-2 min-w-[28px] rounded-full px-2 py-0.5 text-center text-[12px] font-semibold tabular-nums text-white">{index + 1}</span>}
                    />
                    <CardAction label={t('lists.removeTitle', { title: item.title })} onClick={() => remove(item)} disabled={saving} tone="danger" className="absolute end-0 top-0">
                      <X aria-hidden className="h-4 w-4" strokeWidth={2.4} />
                    </CardAction>
                    <div className="absolute inset-x-0 bottom-0 flex justify-between">
                      <CardAction label={t('lists.moveEarlier')} onClick={() => move(index, -1)} disabled={saving || index === 0}>
                        <ChevronLeft aria-hidden className="h-4 w-4 rtl:rotate-180" strokeWidth={2.4} />
                      </CardAction>
                      <CardAction label={t('lists.moveLater')} onClick={() => move(index, 1)} disabled={saving || index === count - 1}>
                        <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" strokeWidth={2.4} />
                      </CardAction>
                    </div>
                  </div>
                  <Link href={routeOf(item)} aria-hidden tabIndex={-1} className="mt-2.5 block truncate px-0.5 text-[13.5px] font-medium text-white/90 transition-colors group-hover/item:text-white">
                    <bdi>{item.title}</bdi>
                  </Link>
                </m.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </section>

      {/* Edit details */}
      <Dialog open={editing} onOpenChange={(open) => !saving && setEditing(open)}>
        <DialogContent className="max-w-md">
          <form onSubmit={saveDetails} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-bold">{t('lists.editDetails')}</DialogTitle>
              <DialogDescription>{t('lists.ownerNote')}</DialogDescription>
            </DialogHeader>
            <ListDetailsFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} autoFocus />
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saving || !title.trim()}>{t('lists.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={confirmingDelete} onOpenChange={(open) => !deleting && setConfirmingDelete(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <span aria-hidden className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-red-600/15 text-red-400 max-sm:mx-auto">
              <Trash2 className="h-5 w-5" />
            </span>
            <DialogTitle className="font-display text-2xl font-bold">{t('lists.deleteTitle', { title: list.title })}</DialogTitle>
            <DialogDescription>{t('lists.deleteDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" disabled={deleting} onClick={() => setConfirmingDelete(false)}>{t('common.cancel')}</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={deleteList}>
              <Trash2 aria-hidden className="h-4 w-4" />{t('lists.deleteList')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
