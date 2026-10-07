"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { Clock, Loader2, Search, SearchX, X } from 'lucide-react'
import { getTrendingSuggestions, searchMovies, type TrendingSuggestion } from './actions'
import MediaGrid, { EmptyState } from '@/src/components/MediaGrid'
import PaginationComponent from '@/src/components/PaginationComponent'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { useT } from '@/src/components/I18nProvider'
import { addRecentSearch, getRecentSearches, removeRecentSearch } from '@/src/lib/recent-searches'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

type Filter = 'all' | 'movie' | 'tv' | 'person'

/**
 * Full search: a big field, results as you type (people first, then titles), a type filter, and
 * when the field is empty, your recent searches and what's trending today.
 */
export default function Page({ searchParams }: { searchParams: { q?: string } }) {
  const t = useT()
  const pillId = useId()
  const input = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    setRecent(getRecentSearches())
    getTrendingSuggestions().then(setTrending).catch(() => {})
  }, [])

  // Wait for the user to stop typing before querying, and start from page 1 for a new query.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  // Keep the address bar shareable without triggering a navigation.
  useEffect(() => {
    const url = debouncedQuery ? `/search?q=${encodeURIComponent(debouncedQuery)}` : '/search'
    window.history.replaceState(window.history.state, '', url)
  }, [debouncedQuery])

  useEffect(() => {
    if (!debouncedQuery) {
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
    searchMovies(debouncedQuery, false, page)
      .then((searchResults) => {
        if (cancelled) return
        setResults(searchResults.results ?? [])
        setTotalPages(searchResults.total_pages || 1)
        setTotalResults(searchResults.total_results || 0)
        if (page === 1 && (searchResults.results ?? []).length) setRecent(addRecentSearch(debouncedQuery))
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
  }, [debouncedQuery, page])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const people = useMemo(() => results.filter((item) => item.media_type === 'person' && item.profile_path), [results])
  const titles = useMemo(() => results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv'), [results])
  const shownTitles = filter === 'all' || filter === 'person' ? titles : titles.filter((item) => item.media_type === filter)
  const counts: Record<Filter, number> = {
    all: people.length + titles.length,
    movie: titles.filter((item) => item.media_type === 'movie').length,
    tv: titles.filter((item) => item.media_type === 'tv').length,
    person: people.length,
  }
  const filters: { value: Filter, label: string }[] = [
    { value: 'all', label: t('search.filterAll') },
    { value: 'movie', label: t('common.movies') },
    { value: 'tv', label: t('common.tvShows') },
    { value: 'person', label: t('search.people') },
  ]
  const nothing = counts.all === 0

  return (
    <div className="page-top min-h-[80vh] pb-10">
      <div className="page-x">
        <label htmlFor="search" className="sr-only">{t('search.label')}</label>
        <div className="group relative mx-auto max-w-3xl">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 start-5 grid place-items-center text-white/45 transition-colors group-focus-within:text-white/80">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Search className="h-6 w-6" />}
          </span>
          <input
            ref={input}
            id="search"
            name="search"
            className="h-16 w-full rounded-full border border-white/10 bg-white/[0.06] pe-14 ps-14 text-lg text-white outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-white/40 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.08] focus:shadow-[0_0_0_6px_rgb(255_255_255/0.05)] [&::-webkit-search-cancel-button]:hidden"
            placeholder={t('search.placeholderPeople')}
            autoComplete="off"
            enterKeyHint="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              type="button"
              aria-label={t('search.clear')}
              onClick={() => { setQuery(''); input.current?.focus() }}
              className="pressable absolute inset-y-0 end-3 my-auto grid h-10 w-10 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {failed ? (
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
              {totalResults > 0 && <p className="text-[13px] text-white/45">{t('search.resultsCount', { count: totalResults })}</p>}
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
                      <span className="block text-[12px] text-white/45">{person.known_for_department === 'Directing' ? t('search.director') : t('search.actor')}</span>
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

      {results.length > 0 && totalPages > 1 && (
        <div className="page-x mb-4 mt-10">
          <PaginationComponent currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  )
}
