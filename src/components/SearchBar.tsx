'use client';
import React, { useState, useEffect, useRef, useId, useMemo } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { IoClose, IoTimeOutline } from 'react-icons/io5';
import { searchMovies } from '@/src/app/search/actions';
import TmdbImage from '@/src/components/TmdbImage'
import routes from '@/src/routes/client/routes';
import { useT } from './I18nProvider';
import { addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch } from '@/src/lib/recent-searches';

const MAX_RESULTS = 8;

type Option =
    | { kind: 'result', key: string, href: string, item: any }
    | { kind: 'recent', key: string, query: string }
    | { kind: 'all', key: string, href: string };

const hrefFor = (item: any) =>
    item.media_type === 'person' ? `/person/${item.id}`
        : item.media_type === 'tv' ? routes.tvShow(item.id)
            : routes.movie(item.id);

/**
 * Navbar search with a live dropdown: movies, TV shows and people (actors, directors), recent
 * searches when the box is empty, and full keyboard support (↑ ↓ Enter Esc) as an ARIA combobox.
 */
const SearchBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const t = useT();
    const listId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [recent, setRecent] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);

    const trimmed = query.trim();

    // Debounced search: wait for a pause in typing, and ignore responses to outdated queries.
    useEffect(() => {
        setActive(-1);
        if (!trimmed) {
            setResults([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        const timeout = setTimeout(async () => {
            try {
                const searchResults = await searchMovies(trimmed, false, 1);
                if (cancelled) return;
                setResults((searchResults.results ?? [])
                    .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv'
                        || (item.media_type === 'person' && item.profile_path))
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
    }, [trimmed]);

    // Close the dropdown when navigating somewhere else.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Close when clicking outside.
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    // What the dropdown shows: results for a query, recent searches for an empty box.
    const options: Option[] = useMemo(() => {
        if (trimmed) {
            const found: Option[] = results.map((item) => ({ kind: 'result', key: `${item.media_type}-${item.id}`, href: hrefFor(item), item }));
            return results.length ? [...found, { kind: 'all', key: 'all', href: `/search?q=${encodeURIComponent(trimmed)}` }] : found;
        }
        return recent.map((entry) => ({ kind: 'recent', key: `recent-${entry}`, query: entry }));
    }, [trimmed, results, recent]);

    const go = (href: string) => {
        if (trimmed) setRecent(addRecentSearch(trimmed));
        setOpen(false);
        router.push(href);
    };

    const choose = (option: Option) => {
        if (option.kind === 'recent') {
            setQuery(option.query);
            setRecent(addRecentSearch(option.query));
            setOpen(true);
            return;
        }
        go(option.href);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) setOpen(true);
            if (!options.length) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((current) => (current + step + options.length) % options.length);
        } else if (e.key === 'Enter') {
            if (open && active >= 0 && options[active]) {
                e.preventDefault();
                choose(options[active]);
            } else if (trimmed) {
                go(`/search?q=${encodeURIComponent(trimmed)}`);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
        }
    };

    const showDropdown = open && (trimmed !== '' || recent.length > 0);
    const optionId = (index: number) => `${listId}-option-${index}`;

    return (
        <div className="flex-1 flex justify-center px-2 lg:ms-6 lg:justify-center">
            <div className="max-w-lg w-full lg:max-w-xs relative" ref={containerRef}>
                <label htmlFor="search" className="sr-only">{t('search.label')}</label>
                <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8 4a6 6 0 105.293 3.293A6.014 6.014 0 0012 8a6 6 0 00-4-5.683V4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        id="search"
                        name="search"
                        role="combobox"
                        aria-expanded={showDropdown}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        aria-activedescendant={showDropdown && active >= 0 ? optionId(active) : undefined}
                        className="transition-all duration-75 ease-in-out block w-full ps-10 pe-3 py-2 border border-transparent rounded-md leading-5 bg-gray-700 dark:bg-[#0d0c0f] text-gray-300 dark:text-white placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-[#1a161f] focus:border-white dark:focus:border-gray-500 focus:ring-white focus:text-gray-900 sm:text-sm"
                        placeholder={t('search.placeholderPeople')}
                        type="search"
                        autoComplete="off"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => { setRecent(getRecentSearches()); setOpen(true); }}
                    />

                    {showDropdown && (
                        <div className="absolute max-h-[520px] overflow-y-auto top-full left-0 right-0 mt-2 bg-gray-800 dark:bg-[#121212] rounded-md shadow-lg w-full max-w-lg z-50">
                            {!trimmed && (
                                <div className="flex items-center justify-between px-3 pt-3 pb-1 text-xs uppercase tracking-wide text-gray-400">
                                    <span>{t('search.recent')}</span>
                                    <button type="button" className="normal-case hover:text-white" onClick={() => setRecent(clearRecentSearches())}>
                                        {t('search.clearRecent')}
                                    </button>
                                </div>
                            )}
                            <ul id={listId} role="listbox" aria-label={t('search.label')} className="text-white">
                                {options.map((option, index) => {
                                    const isActive = index === active;
                                    const base = `flex items-center gap-4 px-3 py-2 cursor-pointer ${isActive ? 'bg-gray-700 dark:bg-zinc-800' : 'hover:bg-gray-700 dark:hover:bg-zinc-900'}`;
                                    if (option.kind === 'recent') {
                                        return (
                                            <li key={option.key} id={optionId(index)} role="option" aria-selected={isActive} className={base}
                                                onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
                                                <IoTimeOutline className="shrink-0 text-gray-400" />
                                                <span className="flex-1 truncate"><bdi>{option.query}</bdi></span>
                                                <button type="button" aria-label={t('search.removeRecent', { query: option.query })}
                                                    className="rounded-full p-1 text-gray-400 hover:bg-zinc-700 hover:text-white"
                                                    onClick={(event) => { event.stopPropagation(); setRecent(removeRecentSearch(option.query)); }}>
                                                    <IoClose />
                                                </button>
                                            </li>
                                        );
                                    }
                                    if (option.kind === 'all') {
                                        return (
                                            <li key={option.key} id={optionId(index)} role="option" aria-selected={isActive}
                                                className={`${base} justify-center border-t border-zinc-700/60 py-3 text-sm text-red-400`}
                                                onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
                                                {t('search.seeAll', { query: trimmed })}
                                            </li>
                                        );
                                    }
                                    const item = option.item;
                                    const isPerson = item.media_type === 'person';
                                    const image = isPerson ? item.profile_path : item.poster_path || item.backdrop_path;
                                    const knownFor = isPerson
                                        ? (item.known_for ?? []).map((work: any) => work.title || work.name).filter(Boolean).slice(0, 2).join(', ')
                                        : '';
                                    return (
                                        <li key={option.key} id={optionId(index)} role="option" aria-selected={isActive} className={base}
                                            onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>
                                            <span className={`relative block w-14 shrink-0 overflow-hidden bg-zinc-800 ${isPerson ? 'h-14 rounded-full' : 'h-[84px] rounded-md'}`}>
                                                <TmdbImage
                                                    kind={isPerson ? 'profile' : 'poster'}
                                                    path={image}
                                                    alt=""
                                                    fill
                                                    sizes="56px"
                                                    className="object-cover"
                                                />
                                            </span>
                                            <span className="min-w-0">
                                                <bdi className="block truncate">{item.title || item.name}</bdi>
                                                <span className="block text-xs opacity-80">
                                                    {isPerson
                                                        ? item.known_for_department === 'Directing' ? t('search.director') : t('search.actor')
                                                        : item.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}
                                                    {!isPerson && (item.release_date || item.first_air_date) ? ` · ${(item.release_date || item.first_air_date).slice(0, 4)}` : ''}
                                                </span>
                                                {knownFor && <span className="block truncate text-xs opacity-60"><bdi>{knownFor}</bdi></span>}
                                            </span>
                                        </li>
                                    );
                                })}
                                {trimmed && !options.length && (
                                    <li className="p-3 text-sm">{loading ? t('search.searching') : t('search.noResults')}</li>
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
