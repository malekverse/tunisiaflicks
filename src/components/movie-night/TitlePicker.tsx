"use client"
// Adding a film to a night: a dialog on desktop, a bottom sheet on phones, with a cmdk list (arrow
// keys, Enter). Before typing: today's trending titles and your list; then live results (220ms
// after the last key). Picking one closes it. The server reads the title back from TMDB anyway:
// what's shown here is only for choosing.
import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { Bookmark, Check, Loader2, Search, TrendingUp } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { useI18n } from '@/src/components/I18nProvider'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/src/components/ui/drawer'
import { getTrendingSuggestions, searchMovies } from '@/src/app/search/actions'
import type { ShareMedia } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'

export type PickedFilm = { key: string; media: ShareMedia; year: string }

type Row = PickedFilm & { backdrop: string | null }

const toRow = (item: any): Row | null => {
  const media_type = item?.media_type === 'tv' ? 'tv' : item?.media_type === 'movie' ? 'movie' : null
  const id = item?.id !== undefined ? String(item.id) : ''
  const title = String(item?.title || item?.name || '').trim()
  if (!media_type || !/^[0-9]{1,9}$/.test(id) || !title) return null
  return {
    key: `${media_type}:${id}`,
    media: { media_type, id, title, poster_path: item.poster_path ?? null },
    year: String(item.year || item.release_date || item.first_air_date || '').slice(0, 4),
    backdrop: item.backdrop_path ?? null,
  }
}

let trendingCache: Promise<Row[]> | null = null

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const onChange = () => setWide(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return wide
}

export default function TitlePicker({ open, onOpenChange, onPick, picked, full = false, heading }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (film: PickedFilm) => void
  /** Keys already on the night (shown as added). */
  picked: string[]
  /** No more room: everything is shown, nothing can be picked. */
  full?: boolean
  heading?: string
}) {
  const { t, dir } = useI18n()
  const wide = useWide()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [trending, setTrending] = useState<Row[]>([])
  const [saved, setSaved] = useState<Row[]>([])
  const trimmed = query.trim()

  useEffect(() => {
    if (!open) return
    setQuery('')
    trendingCache ??= getTrendingSuggestions().then((items) => items.map(toRow).filter((row): row is Row => !!row)).catch(() => {
      trendingCache = null
      return []
    })
    trendingCache.then(setTrending)
    let cancelled = false
    fetch('/api/user-content?type=saved', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data?.items) ? data.items : []
        setSaved(items.slice().reverse().map(toRow).filter((row: Row | null): row is Row => !!row).slice(0, 12))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [open])

  // Debounced search; answers to an older query are dropped.
  useEffect(() => {
    if (!trimmed) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await searchMovies(trimmed, false, 1)
        if (!cancelled) setResults((data.results ?? []).map(toRow).filter((row: Row | null): row is Row => !!row).slice(0, 12))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed])

  const pickedSet = useMemo(() => new Set(picked), [picked])
  const title = heading ?? t('movieNight.picker.title')

  const item = (row: Row, prefix: string) => {
    const added = pickedSet.has(row.key)
    return (
      <Command.Item
        key={`${prefix}-${row.key}`}
        value={`${prefix}-${row.key}`}
        disabled={added || full}
        onSelect={() => {
          if (added || full) return
          onPick({ key: row.key, media: row.media, year: row.year })
          onOpenChange(false)
        }}
        className="group flex min-h-[64px] cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 outline-none data-[disabled=true]:cursor-default data-[selected=true]:bg-white/[0.09]"
      >
        <span className="relative h-[54px] w-9 shrink-0 overflow-hidden rounded-[6px] bg-white/[0.06]">
          <TmdbImage kind="poster" path={row.media.poster_path} alt="" fill sizes="36px" className="object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <bdi dir="auto" className="block truncate text-start text-[15px] text-white">{row.media.title}</bdi>
          <span className="flex gap-x-3 text-[12.5px] text-white/55">
            <span>{row.media.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
            {row.year && <span className="tabular-nums">{row.year}</span>}
          </span>
        </span>
        {added && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-white/70">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} />{t('movieNight.picker.added')}
          </span>
        )}
      </Command.Item>
    )
  }

  const groupHeading = '[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[12.5px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-white/55'

  const body = (
    <Command label={title} shouldFilter={false} loop className="flex min-h-0 flex-1 flex-col" dir={dir}>
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
        {loading
          ? <Loader2 aria-hidden className="h-5 w-5 shrink-0 animate-spin text-white/50" />
          : <Search aria-hidden className="h-5 w-5 shrink-0 text-white/50" />}
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={t('movieNight.picker.search')}
          className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/45"
        />
      </div>
      {full && <p className="px-4 pt-3 text-[13px] text-white/60">{t('movieNight.picker.full')}</p>}
      <Command.List className={cn('no-scrollbar min-h-[200px] flex-1 overflow-y-auto overscroll-contain p-2', groupHeading)}>
        {trimmed && !loading && results.length === 0 && (
          <Command.Empty className="px-3 py-10 text-center text-[14px] text-white/60">{t('movieNight.picker.noResults', { query: trimmed })}</Command.Empty>
        )}
        {trimmed && loading && results.length === 0 && (
          <div className="px-3 py-10 text-center text-[14px] text-white/55">{t('movieNight.picker.loading')}</div>
        )}
        {trimmed && results.length > 0 && (
          <Command.Group heading={t('movieNight.picker.results')}>{results.map((row) => item(row, 'r'))}</Command.Group>
        )}
        {!trimmed && saved.length > 0 && (
          <Command.Group heading={<><Bookmark aria-hidden className="h-3.5 w-3.5" />{t('movieNight.picker.myList')}</>}>{saved.map((row) => item(row, 's'))}</Command.Group>
        )}
        {!trimmed && trending.length > 0 && (
          <Command.Group heading={<><TrendingUp aria-hidden className="h-3.5 w-3.5" />{t('movieNight.picker.trending')}</>}>{trending.map((row) => item(row, 't'))}</Command.Group>
        )}
      </Command.List>
    </Command>
  )

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(640px,calc(100dvh-64px))] max-w-[560px] flex-col overflow-hidden p-0 pt-10">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">{t('movieNight.picker.search')}</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[86dvh]">
        <DrawerTitle className="px-5 pt-3 text-start font-display text-[21px] font-bold">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{t('movieNight.picker.search')}</DrawerDescription>
        <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)]">{body}</div>
      </DrawerContent>
    </Drawer>
  )
}
