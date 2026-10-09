"use client"
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowUpDown, Check, ChevronLeft, ChevronRight, Link2, ListVideo, Lock, Pencil, Plus, Search, Trash2, UsersRound, X } from 'lucide-react'
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
import { spring, tween } from '@/src/lib/motion'
import { searchMovies } from '@/src/app/search/actions'
import { getFavorites, getWatchHistory } from '@/src/lib/user-content'
import { itemKey } from '@/src/lib/shared-lists/rules'
import type { SharedListItem } from '@/src/lib/shared-lists/types'
import type { useSharedList, Candidate } from '@/src/hooks/use-shared-list'
import { cn } from '@/src/lib/utils'
import ListArrange from './ListArrange'
import { LiveActivityLine, RecentChanges } from './ListActivity'
import { ConfirmDialog } from './ListSheet'
import { UNKNOWN } from './people'

type Shared = ReturnType<typeof useSharedList>
type SearchResult = Candidate & { year?: string }

const routeOf = (item: SharedListItem) => `/${item.media_type}/${item.id}`

/** The sentence under the title: who can see the list, and who can change it. */
function RoleSentence({ shared }: { shared: Shared }) {
  const t = useT()
  const { list } = shared
  const owner = list.people[list.members.find((member) => member.role === 'owner')?.id ?? '']
  if (list.visibility === 'private') return <>{t(list.memberCount > 1 ? 'sharedLists.role.privateShared' : 'sharedLists.role.privateSolo')}</>
  if (list.visibility === 'link') return <>{t('sharedLists.role.link')}</>
  return list.role === 'owner' ? <>{t('sharedLists.role.friends')}</> : <>{t('sharedLists.role.friendsOf', { name: owner?.name ?? list.ownerName })}</>
}

const VISIBILITY_ICON = { private: Lock, friends: UsersRound, link: Link2 }

/**
 * A list for the people who build it (the owner and the editors): who can see it, add titles
 * (search, or one tap from your favorites and history), the titles in order (remove with Undo,
 * move with the arrows, or drag in Arrange), what others changed, edit details, delete (owner).
 */
export default function ListEditor({ shared, kids, onOpenPeople }: {
  shared: Shared
  kids: boolean
  /** Opens the people sheet (who's in it, who can see it). */
  onOpenPeople: () => void
}) {
  const router = useRouter()
  const t = useT()
  const { list, busy } = shared
  const owner = list.role === 'owner'
  const together = list.memberCount > 1
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(list.title)
  const [description, setDescription] = useState(list.description)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [arranging, setArranging] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<Candidate[]>([])

  const inList = useMemo(() => new Set(list.items.map(itemKey)), [list.items])

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

  // One-tap suggestions from the viewer's favorites and watch history.
  useEffect(() => {
    Promise.all([getFavorites(), getWatchHistory()]).then(([favorites, history]) => {
      const seen = new Set<string>()
      const merged: Candidate[] = []
      for (const item of [...favorites, ...history]) {
        const key = itemKey(item)
        if (seen.has(key) || !item.poster_path || (item.media_type !== 'movie' && item.media_type !== 'tv')) continue
        seen.add(key)
        merged.push({ id: String(item.id), media_type: item.media_type, title: item.title, poster_path: item.poster_path })
      }
      setSuggestions(merged.slice(0, 18))
    }).catch(() => undefined)
  }, [])

  // Leaving Arrange always lets held changes land.
  useEffect(() => {
    shared.setHolding(arranging)
    return () => shared.setHolding(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arranging])

  const openEditor = () => {
    setTitle(list.title)
    setDescription(list.description)
    setEditing(true)
  }

  const saveDetails = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    if (await shared.saveDetails(title, description)) {
      toast({ title: t('lists.updated'), duration: 2000 })
      setEditing(false)
      router.refresh() // keep the server-rendered parts (share card, page title) in sync
    }
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

  const freshSuggestions = suggestions.filter((item) => !inList.has(itemKey(item)))
  const count = list.items.length
  const VisibilityIcon = VISIBILITY_ICON[list.visibility]
  const byLine = (item: SharedListItem) => {
    if (!together || !item.by) return null
    const person = list.people[item.by] ?? UNKNOWN
    const mine = item.by === list.you
    return (
      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-white/50">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: person.color }} />
        <span className="truncate">{mine ? t('sharedLists.addedByYou') : t('sharedLists.addedBy', { name: person.name })}</span>
      </span>
    )
  }
  // On load: the latest thing someone else did today, as context; then whatever arrives live.
  const latestOther = useMemo(() => list.activity.find((entry) => entry.by !== list.you && Date.now() - new Date(entry.at).getTime() < 24 * 60 * 60 * 1000) ?? null, [list.activity, list.you])

  return (
    <div className="space-y-12">
      {/* Who can see it, and the list's own actions */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="flex items-start gap-3 text-[14px] leading-snug text-white/70">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07]"><VisibilityIcon aria-hidden className="h-4 w-4 text-white/80" /></span>
            <span className="self-center">
              <RoleSentence shared={shared} />
              {owner && !kids && (
                <>
                  {' '}
                  <button type="button" onClick={onOpenPeople} className="-my-3 inline-flex min-h-11 items-center rounded-full px-1 font-semibold text-white underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-500">
                    {t('sharedLists.role.change')}
                  </button>
                </>
              )}
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={openEditor}><Pencil aria-hidden className="h-4 w-4" />{t('lists.editDetails')}</Button>
            {owner && <Button variant="destructive" onClick={() => setConfirmingDelete(true)}><Trash2 aria-hidden className="h-4 w-4" />{t('lists.deleteList')}</Button>}
          </div>
        </div>
        {together && <LiveActivityLine entry={shared.news ?? latestOther} list={list} live={!!shared.news} />}
      </section>

      {/* Add titles */}
      <section className="space-y-4">
        <h2 className="font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">{t('lists.addTitles')}</h2>
        <div className="relative max-w-xl">
          <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/50" />
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
              const added = inList.has(itemKey(item))
              return (
                <li key={itemKey(item)} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white/[0.04]">
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
                    <span className="inline-flex h-11 items-center gap-1.5 px-3 text-[13px] font-medium text-white/55">
                      <Check aria-hidden className="h-4 w-4 text-red-400" strokeWidth={2.4} />{t('lists.addedShort')}
                    </span>
                  ) : (
                    <Button size="sm" variant="white" disabled={busy} onClick={() => shared.add(item)} aria-label={t('lists.addTitle', { title: item.title })} className="h-9 [@media(pointer:coarse)]:h-11">
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
            <div className="no-scrollbar -mx-[var(--gutter)] flex gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-[var(--gutter)] pb-1">
              {freshSuggestions.map((item) => (
                <button
                  key={itemKey(item)}
                  type="button"
                  disabled={busy}
                  onClick={() => shared.add(item)}
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
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <h2 className="flex items-baseline gap-3 font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">
            {t('lists.inThisList')}
            <span className="font-sans text-[14px] font-normal text-white/50">{count === 1 ? t('library.countOne') : t('library.count', { count })}</span>
          </h2>
          {count > 1 && (
            <Button variant={arranging ? 'white' : 'secondary'} onClick={() => setArranging((value) => !value)} aria-pressed={arranging} className="h-11 sm:h-10">
              {arranging ? <Check aria-hidden className="h-4 w-4" /> : <ArrowUpDown aria-hidden className="h-4 w-4" />}
              {t(arranging ? 'sharedLists.arrangeDone' : 'sharedLists.arrange')}
            </Button>
          )}
        </div>

        {/* Someone else's change, waiting until you finish arranging. */}
        <AnimatePresence initial={false}>
          {shared.held && (
            <m.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0, transition: spring.ui }}
              exit={{ opacity: 0, transition: tween.fast }}
              className="mb-4 flex flex-wrap items-center gap-3 rounded-full bg-white/[0.06] py-1.5 pe-1.5 ps-4 text-[14px] text-white/80 ring-1 ring-inset ring-white/[0.08] sm:inline-flex"
            >
              <span role="status">
                {shared.news?.by && list.people[shared.news.by] ? t('sharedLists.held', { name: list.people[shared.news.by].name }) : t('sharedLists.heldMany')}
              </span>
              <Button size="sm" variant="white" className="h-9" onClick={() => { setArranging(false); shared.showHeld() }}>{t('sharedLists.showChanges')}</Button>
            </m.div>
          )}
        </AnimatePresence>

        {count === 0 ? (
          <EmptyState icon={<ListVideo aria-hidden className="h-6 w-6" />} title={t('library.emptyList')}>
            <p>{t('lists.emptyOwner')}</p>
          </EmptyState>
        ) : arranging ? (
          <div className="max-w-2xl">
            <p className="mb-4 text-[13.5px] text-white/60">{t('sharedLists.arrangeHint')}</p>
            <ListArrange items={list.items} disabled={false} onMove={(key, to) => { shared.move(key, to) }} onHolding={(value) => shared.setHolding(value || arranging)} byLine={byLine} />
          </div>
        ) : (
          <ol className={`${GRID_CLASS} relative`}>
            <AnimatePresence mode="popLayout" initial={false}>
              {list.items.map((item, index) => {
                const key = itemKey(item)
                const fresh = shared.newKeys.has(key)
                return (
                  <m.li
                    key={key}
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
                        overlay={
                          <span className="glass absolute start-2 top-2 inline-flex min-w-[28px] items-center justify-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white">
                            <span aria-label={t('home.rank', { rank: index + 1 })}>{index + 1}</span>
                            {fresh && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgb(255_36_20)]"><span className="sr-only">{t('sharedLists.newItem')}</span></span>}
                          </span>
                        }
                      />
                      <CardAction label={t('lists.removeTitle', { title: item.title })} onClick={() => shared.remove(item)} tone="danger" className="absolute end-0 top-0">
                        <X aria-hidden className="h-4 w-4" strokeWidth={2.4} />
                      </CardAction>
                      <div className="absolute inset-x-0 bottom-0 flex justify-between">
                        <CardAction label={t('lists.moveEarlier')} onClick={() => shared.move(key, index - 1)} disabled={index === 0}>
                          <ChevronLeft aria-hidden className="h-4 w-4 rtl:rotate-180" strokeWidth={2.4} />
                        </CardAction>
                        <CardAction label={t('lists.moveLater')} onClick={() => shared.move(key, index + 1)} disabled={index === count - 1}>
                          <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" strokeWidth={2.4} />
                        </CardAction>
                      </div>
                    </div>
                    <Link href={routeOf(item)} aria-hidden tabIndex={-1} className="mt-2.5 block truncate px-0.5 text-[13.5px] font-medium text-white/90 transition-colors group-hover/item:text-white">
                      <bdi>{item.title}</bdi>
                    </Link>
                    <div className={cn('px-0.5', !together && 'hidden')}>{byLine(item)}</div>
                  </m.li>
                )
              })}
            </AnimatePresence>
          </ol>
        )}
      </section>

      {together && <RecentChanges list={list} onPutBack={shared.putBack} disabled={busy} />}

      {/* Edit details */}
      <Dialog open={editing} onOpenChange={(open) => !busy && setEditing(open)}>
        <DialogContent className="max-w-md">
          <form onSubmit={saveDetails} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-bold">{t('lists.editDetails')}</DialogTitle>
              <DialogDescription><RoleSentence shared={shared} /></DialogDescription>
            </DialogHeader>
            <ListDetailsFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} autoFocus />
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={busy || !title.trim()}>{t('lists.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        busy={deleting}
        icon={<Trash2 className="h-5 w-5" />}
        title={t('lists.deleteTitle', { title: list.title })}
        description={t('lists.deleteDesc')}
        confirmLabel={t('lists.deleteList')}
        onConfirm={deleteList}
      />
    </div>
  )
}
