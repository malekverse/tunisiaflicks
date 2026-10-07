"use client";
import React, { useEffect, useState } from 'react'
import { searchMovies } from './actions';
import MediaGrid from '@/src/components/MediaGrid';
import PaginationComponent from '@/src/components/PaginationComponent';

export default function Page({ searchParams }: { searchParams: { q?: string } }) {
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
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
              className="transition-all duration-75 ease-in-out block w-full pl-10 pr-3 py-2 border border-transparent rounded-md leading-5 bg-gray-700 dark:bg-[#1a161f] text-gray-300 dark:text-white placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-[#1a161f] focus:border-white dark:focus:border-gray-500 focus:ring-white focus:text-gray-900 sm:text-sm"
              placeholder="Search movies and TV shows"
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
            <p className='text-gray-400 text-center py-10'>Search is unavailable right now. Please try again in a moment.</p>
          ) : !debouncedQuery ? (
            <p className='text-gray-400 text-center py-10'>Type something to search.</p>
          ) : loading && results.length === 0 ? (
            <p className='text-gray-400 text-center py-10'>Searching…</p>
          ) : results.length === 0 ? (
            <p className='text-gray-400 text-center py-10'>No results for &ldquo;{debouncedQuery}&rdquo;.</p>
          ) : (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
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
