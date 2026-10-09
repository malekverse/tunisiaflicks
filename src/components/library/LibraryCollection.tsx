"use client"
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AnimatePresence, m } from 'framer-motion'
import { Bookmark, Compass, Heart, History, X, type LucideIcon } from 'lucide-react'
import PosterCard, { SkeletonLoader } from '@/src/components/PosterCard'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { TKey } from '@/src/lib/i18n'
import { formatDate } from '@/src/lib/i18n/format'
import type { ContentItem, WatchHistoryItem } from '@/src/lib/models/UserContent'
import {
  addToFavorites, getFavorites, getSavedItems, getWatchHistory, removeFromFavorites, removeFromSaved,
  removeFromWatchHistory, saveForLater,
} from '@/src/lib/user-content'
import LibraryHeader from './LibraryHeader'
import SignInInvite from './SignInInvite'
import { CardAction, Chip, ChipGroup, SortToggle, Toolbar, ToolbarDivider } from './controls'

export type LibraryKind = 'favorites' | 'saved' | 'history'
type Item = ContentItem & Partial<Pick<WatchHistoryItem, 'watched_at' | 'progress'>>

type Config = {
  icon: LucideIcon
  title: TKey
  load: () => Promise<Item[]>
  remove: (id: string) => Promise<unknown>
  /** Puts a removed title back (the toast's Undo). History has none: re-adding would rewrite the date. */
  restore?: (item: Item) => Promise<unknown>
  loadFailed: TKey
  removeFailed: TKey
  removed: TKey
  removedDesc: TKey
  removeLabel: TKey
  dateLabel: TKey
  emptyTitle: TKey
  emptyHint: TKey
  newest: TKey
}

const CONFIG: Record<LibraryKind, Config> = {
  favorites: {
    icon: Heart,
    title: 'library.favoritesTitle',
    load: getFavorites,
    remove: removeFromFavorites,
    restore: addToFavorites,
    loadFailed: 'lists.loadFavoritesFailed',
    removeFailed: 'lists.removeFavoritesFailed',
    removed: 'toast.removedFavorites',
    removedDesc: 'toast.removedFavoritesDesc',
    removeLabel: 'lists.removeFromFavorites',
    dateLabel: 'lists.addedOn',
    emptyTitle: 'lists.noFavorites',
    emptyHint: 'lists.noFavoritesHint',
    newest: 'lists.newestFirst',
  },
  saved: {
    icon: Bookmark,
    title: 'library.savedTitle',
    load: getSavedItems,
    remove: removeFromSaved,
    restore: saveForLater,
    loadFailed: 'lists.loadSavedFailed',
    removeFailed: 'lists.removeSavedItemsFailed',
    removed: 'lists.removedSavedItems',
    removedDesc: 'lists.removedSavedItemsDesc',
    removeLabel: 'lists.removeFromSaved',
    dateLabel: 'lists.savedOn',
    emptyTitle: 'lists.noSavedYet',
    emptyHint: 'lists.noSavedHint',
    newest: 'lists.newestFirst',
  },
  history: {
    icon: History,
    title: 'library.historyTitle',
    load: getWatchHistory,
    remove: removeFromWatchHistory,
    loadFailed: 'lists.loadHistoryFailed',
    removeFailed: 'library.removeHistoryFailed',
    removed: 'library.removedHistory',
    removedDesc: 'library.removedHistoryDesc',
    removeLabel: 'library.removeFromHistory',
    dateLabel: 'lists.watchedOn',
    emptyTitle: 'lists.noHistoryYet',
    emptyHint: 'lists.noHistoryHint',
    newest: 'lists.recentlyWatched',
  },
}

type TypeFilter = 'all' | 'movie' | 'tv'
type ProgressFilter = 'all' | 'in-progress' | 'completed'
type Order = 'newest' | 'oldest'

const keyOf = (item: Item) => `${item.media_type}-${item.id}`
const dateOf = (item: Item, kind: LibraryKind) => new Date((kind === 'history' && item.watched_at) || item.added_at)
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
/** TV history resumes the episode last watched, like Continue Watching. */
const hrefOf = (item: Item, kind: LibraryKind) =>
  kind === 'history' && item.media_type === 'tv' && Number.isInteger(item.season) && Number.isInteger(item.episode)
    ? `/tv/${item.id}?s=${item.season}&e=${item.episode}`
    : `/${item.media_type}/${item.id}`

function insertAt<T>(list: T[], index: number, value: T) {
  const next = list.slice()
  next.splice(Math.min(Math.max(index, 0), next.length), 0, value)
  return next
}

/**
 * Favorites, Saved and Watch history: one page design. A poster grid with type (and progress)
 * filters and a sort, history grouped by day. Removing is instant (rolled back if the server
 * says no), with Undo in the toast where it makes sense. Signed out: an invitation to sign in.
 */
export default function LibraryCollection({ kind }: { kind: LibraryKind }) {
  const { status } = useSession()
  const { t, locale } = useI18n()
  const config = CONFIG[kind]
  const [items, setItems] = useState<Item[] | null>(null)
  const [type, setType] = useState<TypeFilter>('all')
  const [progress, setProgress] = useState<ProgressFilter>('all')
  const [order, setOrder] = useState<Order>('newest')

  useEffect(() => {
    if (status !== 'authenticated') return
    let cancelled = false
    CONFIG[kind].load()
      .then((list) => { if (!cancelled) setItems(list) })
      .catch((error) => {
        console.error(`Error fetching ${kind}:`, error)
        if (cancelled) return
        setItems([])
        toast({ title: t('common.error'), description: t(CONFIG[kind].loadFailed), variant: 'destructive' })
      })
    return () => { cancelled = true }
  }, [status, kind, t])

  const visible = useMemo(() => {
    if (!items) return []
    let result = items
    if (type !== 'all') result = result.filter((item) => item.media_type === type)
    if (kind === 'history' && progress === 'completed') result = result.filter((item) => item.progress === 100)
    if (kind === 'history' && progress === 'in-progress') result = result.filter((item) => item.progress && item.progress < 100)
    return result.slice().sort((a, b) => {
      const difference = dateOf(b, kind).getTime() - dateOf(a, kind).getTime()
      return order === 'newest' ? difference : -difference
    })
  }, [items, type, progress, order, kind])

  // History reads like a diary: Today, Yesterday, then dates.
  const groups = useMemo(() => {
    if (kind !== 'history') return [{ key: 'all', label: null as string | null, items: visible }]
    const today = new Date()
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    const result: { key: string, label: string | null, items: Item[] }[] = []
    for (const item of visible) {
      const date = dateOf(item, kind)
      const key = dayKey(date)
      let group = result[result.length - 1]
      if (!group || group.key !== key) {
        const label = key === dayKey(today) ? t('library.today')
          : key === dayKey(yesterday) ? t('library.yesterday')
            : formatDate(date, locale, {
              weekday: 'long', day: 'numeric', month: 'long',
              ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
            }, { headline: true })
        group = { key, label, items: [] }
        result.push(group)
      }
      group.items.push(item)
    }
    return result
  }, [visible, kind, t, locale])

  const restore = async (item: Item, index: number) => {
    setItems((current) => (current && !current.some((other) => keyOf(other) === keyOf(item)) ? insertAt(current, index, item) : current))
    try {
      await config.restore?.(item)
    } catch {
      setItems((current) => current?.filter((other) => keyOf(other) !== keyOf(item)) ?? current)
      toast({ title: t('common.error'), description: t('library.undoFailed'), variant: 'destructive' })
    }
  }

  const remove = async (item: Item) => {
    if (!items) return
    const index = items.findIndex((other) => keyOf(other) === keyOf(item))
    haptic(8)
    setItems((current) => current?.filter((other) => keyOf(other) !== keyOf(item)) ?? current)
    try {
      await config.remove(item.id)
      toast({
        title: t(config.removed),
        description: t(config.removedDesc, { title: item.title }),
        action: config.restore ? { label: t('library.undo'), onClick: () => restore(item, index) } : undefined,
      })
    } catch (error) {
      console.error(`Failed to remove from ${kind}:`, error)
      setItems((current) => (current && !current.some((other) => keyOf(other) === keyOf(item)) ? insertAt(current, index, item) : current))
      toast({ title: t('common.error'), description: t(config.removeFailed), variant: 'destructive' })
    }
  }

  const signedOut = status === 'unauthenticated'
  const loading = !signedOut && items === null
  const count = items?.length ?? 0
  const subtitle = items === null ? null : count === 1 ? t('library.countOne') : t('library.count', { count })
  const filtered = type !== 'all' || progress !== 'all'

  const toolbar = !signedOut && count > 0 ? (
    <Toolbar>
      <ChipGroup label={t('lists.filterByType')}>
        <Chip active={type === 'all'} onClick={() => setType('all')}>{t('common.all')}</Chip>
        <Chip active={type === 'movie'} onClick={() => setType('movie')}>{t('common.movies')}</Chip>
        <Chip active={type === 'tv'} onClick={() => setType('tv')}>{t('common.tvShows')}</Chip>
      </ChipGroup>
      {kind === 'history' && (
        <>
          <ToolbarDivider />
          <ChipGroup label={t('lists.filterByProgress')}>
            <Chip active={progress === 'all'} onClick={() => setProgress('all')}>{t('lists.allProgress')}</Chip>
            <Chip active={progress === 'in-progress'} onClick={() => setProgress('in-progress')}>{t('lists.inProgress')}</Chip>
            <Chip active={progress === 'completed'} onClick={() => setProgress('completed')}>{t('lists.completed')}</Chip>
          </ChipGroup>
        </>
      )}
      <span className="hidden flex-1 sm:block" />
      <ToolbarDivider />
      <SortToggle
        ariaLabel={t('lists.sortBy')}
        value={order}
        label={t(order === 'newest' ? config.newest : 'lists.oldestFirst')}
        onToggle={() => setOrder(order === 'newest' ? 'oldest' : 'newest')}
      />
    </Toolbar>
  ) : null

  return (
    <div className="page-top pb-10">
      <LibraryHeader title={t(config.title)} subtitle={signedOut ? null : subtitle} toolbar={toolbar} />

      <div className="mt-8 sm:mt-10">
        {signedOut ? (
          <SignInInvite icon={config.icon} />
        ) : loading ? (
          <div className="page-x">
            <p className="sr-only" role="status">{t('common.loading')}</p>
            <div className={GRID_CLASS}>
              {Array.from({ length: 12 }, (_, index) => <SkeletonLoader key={index} />)}
            </div>
          </div>
        ) : count === 0 ? (
          <div className="page-x">
            <EmptyState icon={<config.icon aria-hidden className="h-6 w-6" />} title={t(config.emptyTitle)}>
              <p>{t(config.emptyHint)}</p>
              <Button asChild variant="secondary" className="mt-5">
                <Link href="/discover"><Compass aria-hidden className="h-4 w-4" />{t('library.browse')}</Link>
              </Button>
            </EmptyState>
          </div>
        ) : visible.length === 0 && filtered ? (
          <div className="page-x">
            <EmptyState icon={<config.icon aria-hidden className="h-6 w-6" />} title={t('library.noMatches')}>
              <p>{t('library.noMatchesHint')}</p>
              <Button variant="secondary" className="mt-5" onClick={() => { setType('all'); setProgress('all') }}>{t('library.clearFilters')}</Button>
            </EmptyState>
          </div>
        ) : (
          <div className="page-x space-y-10 sm:space-y-12">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label ?? undefined}>
                {group.label && (
                  <h2 className="mb-4 flex items-baseline gap-3 font-display text-[19px] font-bold text-white sm:text-[22px]">
                    {group.label}
                    <span className="font-sans text-[13px] font-normal text-white/50">{group.items.length}</span>
                  </h2>
                )}
                <div className={cn(GRID_CLASS, 'relative')}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {group.items.map((item) => (
                      <LibraryCard key={keyOf(item)} item={item} kind={kind} config={config} onRemove={() => remove(item)} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const LibraryCard = React.forwardRef<HTMLDivElement, { item: Item, kind: LibraryKind, config: Config, onRemove: () => void }>(
  function LibraryCard({ item, kind, config, onRemove }, ref) {
    const { t, dateLocale } = useI18n()
    const href = hrefOf(item, kind)
    const date = dateOf(item, kind)
    const percent = kind === 'history' ? item.progress ?? 0 : 0
    const episode = kind === 'history' && item.media_type === 'tv' && Number.isInteger(item.season) && Number.isInteger(item.episode)
      ? t('common.seasonEpisode', { season: item.season!, episode: item.episode! })
      : null

    return (
      <m.div
        ref={ref}
        layout="position"
        transition={spring.ui}
        exit={{ opacity: 0, scale: 0.92, transition: tween.fast }}
        className="group/item relative"
      >
        <PosterCard
          bare
          peek={false}
          id={item.id}
          title={item.title}
          posterImg={item.poster_path}
          mediaType={item.media_type}
          link={href}
          overlay={percent > 0 && percent < 100 ? (
            <>
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 to-transparent" />
              <span
                role="progressbar"
                aria-label={t('lists.progress')}
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="absolute inset-x-2.5 bottom-2.5 h-1 overflow-hidden rounded-full bg-white/25"
              >
                <span className="block h-full rounded-full bg-red-500" style={{ width: `${percent}%` }} />
              </span>
            </>
          ) : undefined}
        />
        {/* The caption repeats the poster's link for the pointer; screen readers get the poster's. */}
        <Link href={href} aria-hidden tabIndex={-1} className="mt-2.5 block px-0.5">
          <p className="truncate text-[13.5px] font-medium text-white/90 transition-colors group-hover/item:text-white"><bdi>{item.title}</bdi></p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12px] text-white/50">
            <span>{t(item.media_type === 'tv' ? 'common.tvShow' : 'common.movie')}</span>
            {episode && <span>{episode}</span>}
            {kind === 'history'
              ? <span>{date.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</span>
              : <span title={t(config.dateLabel, { date: date.toLocaleDateString(dateLocale) })}>{date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}</span>}
          </p>
        </Link>
        <CardAction label={`${t(config.removeLabel)}: ${item.title}`} onClick={onRemove} tone="danger" className="absolute end-0 top-0">
          <X aria-hidden className="h-4 w-4" strokeWidth={2.4} />
        </CardAction>
      </m.div>
    )
  }
)
