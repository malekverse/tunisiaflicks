"use client";
import React, { useEffect, useState } from 'react'
import { searchMovies } from './actions';
import MediaGrid from '@/src/components/MediaGrid';
import PaginationComponent from '@/src/components/PaginationComponent';
import { useT } from '@/src/components/I18nProvider';
import Link from 'next/link';
import TmdbImage from '@/src/components/TmdbImage';
import { addRecentSearch } from '@/src/lib/recent-searches';

export default function Page({ searchParams }: { searchParams: { q?: string } }) {
  const t = useT();
  const [query, setQuery] = useState(searchParams.q || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Wait for the user to stop typing before querying, and start from page 1 for a new query.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  // Keep the address bar shareable without triggering a navigation.
  useEffect(() => {
    const url = debouncedQuery ? `/search?q=${encodeURIComponent(debouncedQuery)}` : '/search';
    window.history.replaceState(window.history.state, '', url);
  }, [debouncedQuery]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setTotalPages(1);
      setFailed(false);
      setLoading(false);
      return;
    }

    // Ignore the response of a request that has since been superseded by a newer query/page.
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    searchMovies(debouncedQuery, false, page)
      .then((searchResults) => {
        if (cancelled) return;
        setResults(searchResults.results ?? []);
        setTotalPages(searchResults.total_pages || 1);
        if (page === 1 && (searchResults.results ?? []).length) addRecentSearch(debouncedQuery);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error fetching search results:", error);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className='flex flex-col min-h-[calc(80vh)] w-full max-w-[1800px] px-4 sm:px-6'>
      <div className='flex-grow'>
        {/* search bar */}
        <div className="w-full">
          <label htmlFor="search" className="sr-only">
            {t('search.label')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a6 6 0 105.293 3.293A6.014 6.014 0 0012 8a6 6 0 00-4-5.683V4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              id="search"
              name="search"
              className="transition-all duration-75 ease-in-out block w-full ps-10 pe-3 py-2 border border-transparent rounded-md leading-5 bg-gray-700 dark:bg-[#1a161f] text-gray-300 dark:text-white placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-[#1a161f] focus:border-white dark:focus:border-gray-500 focus:ring-white focus:text-gray-900 sm:text-sm"
              placeholder={t('search.placeholderFull')}
              autoComplete="off"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={true}
            />
          </div>
        </div>

        {/* Content */}
        <div className='mt-5'>
          {failed ? (
            <p className='text-gray-400 text-center py-10'>{t('search.unavailable')}</p>
          ) : !debouncedQuery ? (
            <p className='text-gray-400 text-center py-10'>{t('search.typeSomething')}</p>
          ) : loading && results.length === 0 ? (
            <p className='text-gray-400 text-center py-10'>{t('search.searching')}</p>
          ) : results.filter((item) => item.media_type !== 'person' || item.profile_path).length === 0 ? (
            <p className='text-gray-400 text-center py-10'>{t('search.noResultsFor', { query: debouncedQuery })}</p>
          ) : (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              {/* People (actors, directors) first, as a row of portraits. */}
              {results.some((item) => item.media_type === 'person' && item.profile_path) && (
                <section aria-label={t('search.people')} className='mb-8'>
                  <h2 className='text-xl font-semibold mb-3'>{t('search.people')}</h2>
                  <div className='flex gap-4 overflow-x-auto no-scrollbar pb-2'>
                    {results.filter((item) => item.media_type === 'person' && item.profile_path).map((person) => (
                      <Link key={person.id} href={`/person/${person.id}`} className='group w-28 shrink-0 text-center'>
                        <span className='relative mx-auto block h-28 w-28 overflow-hidden rounded-full bg-zinc-800 ring-2 ring-transparent transition group-hover:ring-red-500'>
                          <TmdbImage
                            kind='profile'
                            path={person.profile_path}
                            alt={person.name}
                            fill
                            sizes='112px'
                            className='object-cover'
                            style={{ objectPosition: '0 25%' }}
                          />
                        </span>
                        <bdi className='mt-2 block truncate text-sm font-medium'>{person.name}</bdi>
                        <span className='block text-xs text-gray-500'>{person.known_for_department === 'Directing' ? t('search.director') : t('search.actor')}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              <MediaGrid items={results} showTypeBadge />
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {results.length > 0 && totalPages > 1 && (
        <div className="mt-8 mb-4">
          <PaginationComponent currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  )
}
