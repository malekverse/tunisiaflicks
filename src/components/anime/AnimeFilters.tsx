"use client"
import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { FORMATS, SEASONS, SORTS } from '@/src/lib/anime/model'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'

const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED'] as const
/** "Any" in a filter (the site's Select can't hold an empty value). */
const ANY = 'any'

/**
 * Browse's search box and filters. Everything lives in the address (?q=&genre=&season=…), so a
 * filtered page can be shared and Back works; typing searches after a short pause.
 */
export default function AnimeFilters({ genres }: { genres: readonly string[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const [text, setText] = useState(params.get('q') ?? '')
  const first = useRef(true)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    const query = next.toString()
    start(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  // Search as they type, after a pause.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const timer = window.setTimeout(() => update({ q: text.trim() || null }), 450)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const year = new Date().getFullYear()
  const years = Array.from({ length: year + 2 - 1960 }, (_, index) => year + 1 - index)
  const any = t('anime.browse.any')
  const filtered = ['genre', 'season', 'year', 'format', 'status', 'sort', 'q'].some((key) => params.get(key))

  const select = (key: string, label: TKey, options: { value: string, label: string }[]) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={`anime-filter-${key}`} className="text-[12px] font-medium text-white/50">{t(label)}</span>
      <Select value={params.get(key) || ANY} onValueChange={(value) => update({ [key]: value === ANY ? null : value })}>
        <SelectTrigger aria-labelledby={`anime-filter-${key}`} className="h-10 min-w-0 rounded-[12px] px-3 text-[14px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[min(320px,var(--radix-select-content-available-height))]">
          <SelectItem value={ANY}>{any}</SelectItem>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className={cn('page-x space-y-4 transition-opacity', pending && 'opacity-70')}>
      <div className="relative max-w-[720px]">
        <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('anime.browse.search')}
          aria-label={t('anime.browse.search')}
          maxLength={80}
          className="h-12 w-full rounded-full bg-white/[0.07] pe-12 ps-12 text-[15px] text-white outline-none ring-1 ring-inset ring-white/10 placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-red-500"
        />
        {text && (
          <button type="button" onClick={() => setText('')} aria-label={t('anime.browse.clear')} className="absolute end-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
            <X aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {select('genre', 'anime.browse.genre', genres.map((genre) => ({ value: genre, label: t(`anime.genre.${genre}` as TKey) })))}
        {select('season', 'anime.browse.season', SEASONS.map((season) => ({ value: season, label: t(`anime.season.${season}` as TKey) })))}
        {select('year', 'anime.browse.year', years.map((value) => ({ value: String(value), label: String(value) })))}
        {select('format', 'anime.browse.format', FORMATS.map((format) => ({ value: format, label: t(`anime.format.${format}` as TKey) })))}
        {select('status', 'anime.browse.status', STATUSES.map((status) => ({ value: status, label: t(`anime.status.${status}` as TKey) })))}
        {select('sort', 'anime.browse.sort', SORTS.map((sort) => ({ value: sort, label: t(`anime.sort.${sort}` as TKey) })))}
      </div>
      {filtered && (
        <button type="button" onClick={() => { setText(''); start(() => router.replace(pathname, { scroll: false })) }} className="text-[13px] font-medium text-white/55 underline-offset-4 hover:text-white hover:underline">
          {t('anime.browse.clear')}
        </button>
      )}
    </div>
  )
}
