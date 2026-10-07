'use client';
import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { searchMovies } from '@/src/app/search/actions';
import routes from '@/src/routes/client/routes';
import Link from "next/link";
import { useT } from './I18nProvider';

const MAX_RESULTS = 8;

const SearchBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const t = useT();
    const containerRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState(""); // Holds the search input
    const [results, setResults] = useState<any[]>([]); // Movie / TV results shown in the dropdown
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false); // Show/Hide search results

    // Debounced search: wait for a pause in typing, and ignore responses to outdated queries.
    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            setLoading(false);
            setShowResults(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setShowResults(true);
        const timeout = setTimeout(async () => {
            try {
                const searchResults = await searchMovies(trimmed, false, 1);
                if (cancelled) return;
                setResults((searchResults.results ?? [])
                    .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
                    .slice(0, MAX_RESULTS));
            } catch (error) {
                if (cancelled) return;
                console.error("Error fetching search results:", error);
                setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query]);

    // Close the dropdown when navigating somewhere else.
    useEffect(() => {
        setShowResults(false);
    }, [pathname]);

    // Close search results when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowResults(false);
        };
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && query.trim() !== '') {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            setShowResults(false);
        }
    };

    return (
        <div className="flex-1 flex justify-center px-2 lg:ms-6 lg:justify-center">
            <div className="max-w-lg w-full lg:max-w-xs relative" ref={containerRef}>
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
                        className="transition-all duration-75 ease-in-out block w-full ps-10 pe-3 py-2 border border-transparent rounded-md leading-5 bg-gray-700 dark:bg-[#0d0c0f] text-gray-300 dark:text-white placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-[#1a161f] focus:border-white dark:focus:border-gray-500 focus:ring-white focus:text-gray-900 sm:text-sm"
                        placeholder={t('search.placeholder')}
                        type="search"
                        autoComplete="off"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => query.trim() !== "" && setShowResults(true)}
                    />

                    {/* Search Results Container */}
                    {showResults && (
                        <div className="absolute max-h-[500px] overflow-y-auto top-full left-0 right-0 mt-2 bg-gray-800 dark:bg-[#121212] rounded-md shadow-lg w-full max-w-lg">
                            <ul className="text-white">
                                {results.length > 0 ? (
                                    results.map((item) => (
                                        <li key={`${item.media_type}-${item.id}`}>
                                            <Link
                                                href={item.media_type === "movie" ? routes.movie(item.id) : routes.tvShow(item.id)}
                                                className="p-3 hover:bg-gray-700 dark:hover:bg-zinc-900 flex gap-5"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={item.poster_path || item.backdrop_path ? `https://image.tmdb.org/t/p/w154${item.poster_path || item.backdrop_path}` : "/404.png"}
                                                    alt=""
                                                    width={80}
                                                    height={120}
                                                    loading="lazy"
                                                    className="w-20 h-[120px] object-cover rounded-md bg-zinc-800"
                                                />
                                                <span>
                                                    {item.title || item.name}
                                                    <span className="block text-xs opacity-80">{item.release_date || item.first_air_date || ''}</span>
                                                    <span className="block text-xs opacity-80">{item.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))
                                ) : (
                                    <li className="p-2">{loading ? t('search.searching') : t('search.noResults')}</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchBar;
