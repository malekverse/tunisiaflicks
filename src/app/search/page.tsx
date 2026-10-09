"use client";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { ArrowRight, Clock, Info, Loader2, Search, SearchX, Sparkle, X } from 'lucide-react'
import { getTrendingSuggestions, searchMovies, type TrendingSuggestion } from './actions'
import MediaGrid, { EmptyState } from '@/src/components/MediaGrid'
import PaginationComponent from '@/src/components/PaginationComponent'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { useI18n } from '@/src/components/I18nProvider'
import { useAskAvailable } from '@/src/components/search/ai/AskContext'
import { ModeSwitch, type SearchMode } from '@/src/components/search/ai/ModeSwitch'
import { AskPanel } from '@/src/components/search/ai/AskPanel'
import { askUrl, useAiSearch, type AskState } from '@/src/components/search/ai/use-ai-search'
import { addRecentSearch, getRecentSearches, removeRecentSearch } from '@/src/lib/recent-searches'
import { MAX_QUERY, cleanInput, wordCount } from '@/src/lib/ai-search/normalize'
import { decodePlan, encodePlan, removeFacet } from '@/src/lib/ai-search/plan-codec'
import { quote } from '@/src/lib/i18n/format'
import { toast } from '@/src/hooks/use-toast'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { AskChip } from '@/src/lib/ai-search/types'

type Filter = 'all' | 'movie' | 'tv' | 'person'
type Params = { q?: string, mode?: string, p?: string }

const UNDO_MS = 5000

/**
 * Full search: a big field, results as you type (people first, then titles), a type filter, and
 * when the field is empty, your recent searches and what's trending today.
 *
 * With Ask (AI search; grown-ups, outside TV mode, when the site has it): a Titles | Ask switch.
 * In Ask mode the field takes a description and Enter asks; the answer is the chips of what was
 * understood (each removable, with Undo), the titles, and the AI note. The address bar keeps
 * /search?mode=ask&q=…&p=…, so a link replays the plan without asking the model again.
 */
export default function Page({ searchParams }: { searchParams: Params }) {
  const { t, locale } = useI18n()
  const askAvailable = useAskAvailable()
  const pillId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<SearchMode>(askAvailable && searchParams.mode === 'ask' ? 'ask' : 'titles')
  const [query, setQuery] = useState(searchParams.q || "")
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [recent, setRecent] = useState<string[]>([])
  const [trending, setTrending] = useState<TrendingSuggestion[]>([])
  /** Ask sent us here: a bare title, or Ask resting with nothing it could use. */
  const [switched, setSwitched] = useState<null | 'title' | 'resting'>(null)

  const titles = mode === 'titles'
  // The title search only runs in Titles mode.
  const titleQuery = titles ? debouncedQuery : ''

  const onSwitch = useCallback((q: string, reason: 'title' | 'resting') => {
    setMode('titles')
    setQuery(q)
    setDebouncedQuery(q.trim())
    setPage(1)
    setSwitched(reason)
  }, [])
  const ai = useAiSearch({
    onSwitch,
    onMoreFailed: () => toast({ title: t('ai.error.failed'), variant: 'destructive' }),
  })
  const askState = ai.state

  useEffect(() => {
    setRecent(getRecentSearches())
    getTrendingSuggestions().then(setTrending).catch(() => {})
  }, [])

  // Arriving in Ask mode with a question: replay its plan (p=) or ask it. On the next tick, so a
  // mount that is immediately undone (React's development double mount) never asks twice.
  useEffect(() => {
    const q = cleanInput(searchParams.q ?? '')
    if (mode !== 'ask' || !q) return
    const timer = setTimeout(() => {
      if (searchParams.p) ai.open(q, searchParams.p)
      else ai.ask(q)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A link to /search while already here (the palette, "See all results") changes the props, not
  // the page: follow it. What this page wrote itself with replaceState is ignored.
  const navKey = `${searchParams.mode ?? ''}|${searchParams.q ?? ''}|${searchParams.p ?? ''}`
  const seenNav = useRef(navKey)
  useEffect(() => {
    if (navKey === seenNav.current) return
    seenNav.current = navKey
    const q = searchParams.q ?? ''
    if (q === query && (searchParams.mode === 'ask') === (mode === 'ask') && (!searchParams.p || searchParams.p === askState.p)) return
    setSwitched(null)
    setQuery(q)
    if (askAvailable && searchParams.mode === 'ask') {
      setMode('ask')
      const clean = cleanInput(q)
      if (!clean) ai.reset()
      else if (searchParams.p) ai.open(clean, searchParams.p)
      else ai.ask(clean)
    } else {
      setMode('titles')
      setDebouncedQuery(q.trim())
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey])

  // Wait for the user to stop typing before querying, and start from page 1 for a new query.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  // Keep the address bar shareable without triggering a navigation (Ask mode writes its own).
  useEffect(() => {
    if (!titles) return
    const url = debouncedQuery ? `/search?q=${encodeURIComponent(debouncedQuery)}` : '/search'
    window.history.replaceState(window.history.state, '', url)
  }, [debouncedQuery, titles])

  useEffect(() => {
    if (!titleQuery) {
      setResults([])
      setTotalPages(1)
      setTotalResults(0)
      setFailed(false)
      setLoading(false)
      return
    }

    // Ignore the response of a request that has since been superseded by a newer query/page.
    let cancelled = false
    setLoading(true)
    setFailed(false)
    searchMovies(titleQuery, false, page)
      .then((searchResults) => {
        if (cancelled) return
        setResults(searchResults.results ?? [])
        setTotalPages(searchResults.total_pages || 1)
        setTotalResults(searchResults.total_results || 0)
        if (page === 1 && (searchResults.results ?? []).length) setRecent(addRecentSearch(titleQuery))
      })
      .catch((error) => {
        if (cancelled) return
        console.error("Error fetching search results:", error)
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [titleQuery, page])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // ---- Ask -------------------------------------------------------------------------------------

  const askNow = (text: string) => {
    const q = cleanInput(text)
    if (!q) return
    setSwitched(null)
    if (q !== query) setQuery(q)
    addRecentSearch(q)
    ai.ask(q)
  }

  const changeMode = (next: SearchMode) => {
    if (next === mode) return
    setSwitched(null)
    setMode(next)
    if (next === 'ask') {
      const q = cleanInput(query)
      // What's in the field is asked right away; an empty field shows the examples.
      if (q && q !== askState.q) askNow(q)
      else window.history.replaceState(window.history.state, '', askUrl(q, askState.q === q ? askState.p : null))
    } else {
      setDebouncedQuery(query.trim())
      setPage(1)
    }
    input.current?.focus()
  }

  const removeChip = (chip: AskChip) => {
    const plan = decodePlan(askState.p)
    if (!plan) return
    const snapshot: AskState = askState
    ai.edit(encodePlan(removeFacet(plan, chip.id)), chip.id)
    toast({
      title: t('ai.removed', { label: quote(chip.label, locale) }),
      duration: UNDO_MS,
      action: { label: t('ai.undo'), onClick: () => ai.restore(snapshot) },
    })
  }

  const retryAsk = () => {
    if (askState.p && askState.chips.length) ai.open(askState.q, askState.p)
    else askNow(askState.q || query)
  }

  // ---- Titles ----------------------------------------------------------------------------------

  const people = useMemo(() => results.filter((item) => item.media_type === 'person' && item.profile_path), [results])
  const titleItems = useMemo(() => results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv'), [results])
  const shownTitles = filter === 'all' || filter === 'person' ? titleItems : titleItems.filter((item) => item.media_type === filter)
  const counts: Record<Filter, number> = {
    all: people.length + titleItems.length,
    movie: titleItems.filter((item) => item.media_type === 'movie').length,
    tv: titleItems.filter((item) => item.media_type === 'tv').length,
    person: people.length,
  }
  const filters: { value: Filter, label: string }[] = [
    { value: 'all', label: t('search.filterAll') },
    { value: 'movie', label: t('common.movies') },
    { value: 'tv', label: t('common.tvShows') },
    { value: 'person', label: t('search.people') },
  ]
  const nothing = counts.all === 0
  const askInstead = askAvailable && titles && !switched && wordCount(query) >= 3
  const fieldBusy = titles ? loading : askState.phase === 'loading'

  return (
    <div className="page-top min-h-[80vh] pb-10">
      <div className="page-x">
        <div className={cn('mx-auto', askAvailable ? 'max-w-4xl' : 'max-w-3xl')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="search" className="sr-only">{t(titles ? 'search.label' : 'ai.placeholder')}</label>
            <div className="group relative min-w-0 flex-1">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 start-5 grid place-items-center text-white/45 transition-colors group-focus-within:text-white/80">
                {fieldBusy ? <Loader2 className="h-6 w-6 animate-spin" />
                  : titles ? <Search className="h-6 w-6" />
                    : <Sparkle className="h-6 w-6 fill-current" strokeWidth={1.4} />}
              </span>
              <input
                ref={input}
                id="search"
                name="search"
                className={cn(
                  'h-16 w-full text-ellipsis rounded-full border border-white/10 bg-white/[0.06] ps-14 text-lg text-white outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-white/50 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.08] focus:shadow-[0_0_0_6px_rgb(255_255_255/0.05)] [&::-webkit-search-cancel-button]:hidden',
                  !query ? 'pe-6' : titles ? 'pe-14' : 'pe-[6.5rem]',
                  // Ask draws its own placeholder (below), so it can be shorter on phones and end in an ellipsis.
                  !titles && 'placeholder:text-transparent',
                )}
                placeholder={t(titles ? 'search.placeholderPeople' : 'ai.placeholder')}
                autoComplete="off"
                enterKeyHint="search"
                type="search"
                maxLength={titles ? undefined : MAX_QUERY}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (switched) setSwitched(null)
                }}
                onKeyDown={(event) => {
                  if (!titles && event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    askNow(query)
                  }
                }}
                autoFocus
              />
              {!titles && !query && (
                <span aria-hidden className="pointer-events-none absolute inset-y-0 end-6 start-14 flex min-w-0 items-center text-lg text-white/50">
                  <span className="truncate sm:hidden">{t('ai.placeholderShort')}</span>
                  <span className="hidden truncate sm:block">{t('ai.placeholder')}</span>
                </span>
              )}
              {query && (
                <div className="absolute inset-y-0 end-3 my-auto flex h-10 items-center gap-1">
                  <button
                    type="button"
                    aria-label={t('search.clear')}
                    onClick={() => { setQuery(''); setSwitched(null); input.current?.focus() }}
                    className="pressable grid h-10 w-10 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <X aria-hidden className="h-5 w-5" />
                  </button>
                  {!titles && (
                    <button
                      type="button"
                      aria-label={t('ai.ask')}
                      onClick={() => askNow(query)}
                      className="pressable grid h-10 w-10 place-items-center rounded-full bg-white text-black outline-none transition-colors hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <ArrowRight aria-hidden className="h-5 w-5 rtl:rotate-180" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {askAvailable && <ModeSwitch mode={mode} onChange={changeMode} />}
          </div>

          {/* Titles mode, a description typed: a quiet way to Ask it instead. */}
          {askInstead && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 ps-2 text-[13px] text-white/55">
              <span>{t('ai.askInstead.lead')}</span>
              <button
                type="button"
                onClick={() => { setMode('ask'); askNow(query) }}
                className="pressable inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2 font-medium text-white outline-none hover:text-white/80 focus-visible:ring-2 focus-visible:ring-red-500 sm:min-h-0 sm:py-1"
              >
                <Sparkle aria-hidden className="h-3.5 w-3.5 fill-current" strokeWidth={1.4} />
                {t('ai.askInstead')}
              </button>
            </p>
          )}
          {switched && titles && (
            <p role="status" className="mt-3 flex items-start gap-2 ps-2 text-[13px] leading-snug text-white/60">
              <Info aria-hidden className="mt-[2px] h-3.5 w-3.5 shrink-0 text-white/50" />
              <span>{t(switched === 'resting' ? 'ai.notice.resting' : 'ai.notice.switched')}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        {!titles ? (
          <AskPanel
            state={askState}
            onTry={askNow}
            onRemove={removeChip}
            onMore={() => { void ai.more() }}
            onRetry={retryAsk}
            onSearchTitles={() => changeMode('titles')}
            focusField={() => input.current?.focus()}
          />
        ) : failed ? (
          <div className="page-x"><EmptyState icon={<SearchX aria-hidden className="h-6 w-6" />}>{t('search.unavailable')}</EmptyState></div>
        ) : !debouncedQuery ? (
          <div className="space-y-10">
            {recent.length > 0 && (
              <section className="page-x">
                <h2 className="mb-3 text-[13px] font-medium text-white/50">{t('search.recent')}</h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((entry) => (
                    <span key={entry} className="group inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] ps-3.5 text-[14px] text-white/85">
                      <button type="button" onClick={() => setQuery(entry)} className="inline-flex items-center gap-2 outline-none">
                        <Clock aria-hidden className="h-4 w-4 text-white/45" /><bdi>{entry}</bdi>
                      </button>
                      <button
                        type="button"
                        aria-label={t('search.removeRecent', { query: entry })}
                        onClick={() => setRecent(removeRecentSearch(entry))}
                        className="ms-1 grid h-10 w-9 place-items-center rounded-full text-white/40 hover:text-white"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            )}
            {trending.length > 0 ? (
              <section>
                <SectionHeader title={t('search.trendingNow')} />
                <Row itemClassName="w-[72vw] max-w-[300px] sm:w-[300px] sm:max-w-none">
                  {trending.map((item) => (
                    <Link key={`${item.media_type}-${item.id}`} href={`/${item.media_type}/${item.id}`} className="group/trend block outline-none">
                      <span className="relative block aspect-video overflow-hidden rounded-tile bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-transform duration-300 ease-out group-hover/trend:-translate-y-1 group-focus-visible/trend:ring-2 group-focus-visible/trend:ring-red-500">
                        <TmdbImage kind="backdrop" path={item.backdrop_path || item.poster_path} alt="" fill sizes="300px" className="object-cover" />
                        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                        <span className="absolute inset-x-0 bottom-0 p-3">
                          <bdi className="line-clamp-1 font-display text-[18px] font-bold">{item.title}</bdi>
                          <span className="flex gap-2 text-[12px] text-white/60"><span>{item.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>{item.year && <span>{item.year}</span>}</span>
                        </span>
                      </span>
                    </Link>
                  ))}
                </Row>
              </section>
            ) : (
              <div className="page-x"><EmptyState title={t('search.emptyTitle')} icon={<Search aria-hidden className="h-6 w-6" />}>{t('search.emptyText')}</EmptyState></div>
            )}
          </div>
        ) : loading && results.length === 0 ? (
          <div className="page-x grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-x-4">
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="tf-shimmer relative aspect-[2/3] rounded-poster" />)}
          </div>
        ) : nothing ? (
          <div className="page-x">
            <EmptyState title={t('search.noResultsTitle')} icon={<SearchX aria-hidden className="h-6 w-6" />}>
              <p>{t('search.noResultsFor', { query: debouncedQuery })}</p>
              <p className="mt-1">{t('search.noResultsHint')}</p>
            </EmptyState>
          </div>
        ) : (
          <div className={cn('transition-opacity duration-300', loading && 'opacity-60')}>
            <div className="page-x mb-8 flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label={t('search.filterAria')} className="flex w-fit rounded-full bg-white/[0.07] p-1">
                {filters.filter((item) => item.value === 'all' || counts[item.value] > 0).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.value}
                    onClick={() => setFilter(item.value)}
                    className={cn('relative h-9 rounded-full px-4 text-[14px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500', filter === item.value ? 'text-black' : 'text-white/70 hover:text-white')}
                  >
                    {filter === item.value && <m.span layoutId={`search-filter-${pillId}`} transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
                    <span className="relative">{item.label}</span>
                  </button>
                ))}
              </div>
              {totalResults > 0 && <p className="text-[13px] text-white/50">{t('search.resultsCount', { count: totalResults })}</p>}
            </div>

            {/* People (actors, directors) first, as a row of portraits. */}
            {people.length > 0 && (filter === 'all' || filter === 'person') && (
              <section aria-label={t('search.people')} className="mb-10">
                <SectionHeader title={t('search.people')} />
                <Row itemClassName="w-[104px] sm:w-[124px]" gap="gap-3 sm:gap-5">
                  {people.map((person) => (
                    <Link key={person.id} href={`/person/${person.id}`} className="group/person block text-center outline-none">
                      <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 ease-out group-hover/person:-translate-y-1 group-hover/person:ring-white/40 group-focus-visible/person:ring-2 group-focus-visible/person:ring-red-500">
                        <TmdbImage kind="profile" path={person.profile_path} alt={person.name} fill sizes="124px" className="object-cover object-[50%_25%]" />
                      </span>
                      <bdi className="mt-2.5 block truncate text-[13px] font-medium text-white/90">{person.name}</bdi>
                      <span className="block text-[12px] text-white/50">{person.known_for_department === 'Directing' ? t('search.director') : t('search.actor')}</span>
                    </Link>
                  ))}
                </Row>
              </section>
            )}
            {filter !== 'person' && (
              <div className="page-x">
                <MediaGrid items={shownTitles} showTypeBadge={filter === 'all'} />
              </div>
            )}
          </div>
        )}
      </div>

      {titles && results.length > 0 && totalPages > 1 && (
        <div className="page-x mb-4 mt-10">
          <PaginationComponent currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  )
}
