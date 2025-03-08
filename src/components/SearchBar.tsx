'use client';
import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { searchMovies } from '@//src/app/search/actions';
import routes from '@/src/routes/client/routes';
import Image from "next/image";
import Link from "next/link";

const SearchBar = () => {
    const router = useRouter(); // Initialize the router
    const [query, setQuery] = useState(""); // Holds the search input
    const [data, setData] = useState({}); // Holds the search results data
    const [results, setResults] = useState([]); // Holds the filtered search results
    const [loader, setLoader] = useState(true); // For loading state
    const [adult, setAdult] = useState(false); // For adult content filter
    const [page, setPage] = useState(1); // Current page for pagination
    const [totalPages, setTotalPages] = useState(1); // Total pages for pagination
    const [showResults, setShowResults] = useState(false); // Show/Hide search results

    // Handle fetching search results
    useEffect(() => {
        async function fetchSearchData() {
            try {
                const searchResults = await searchMovies(query, adult, page);
                setData(searchResults);
                setResults(searchResults.results);
                setTotalPages(searchResults.total_pages);
                setLoader(false);
                console.log(searchResults.results);
            } catch (error) {
                console.error("Error fetching search results:", error);
                setLoader(false);
            }
        }

        if (query.trim() !== "") {
            fetchSearchData();
            setShowResults(true); // Show results when query is non-empty
        } else {
            setResults([]);
            setShowResults(false); // Hide results when the query is empty
        }
    }, [query, adult, page]);

    // Handle key press events
    const handleKeyDown = (e) => {
        // If Enter key is pressed and query is not empty
        if (e.key === 'Enter' && query.trim() !== '') {
            // Navigate to search page with query
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            setShowResults(false); // Hide results
        }
    };

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest("#search-container")) {
                setShowResults(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, []);

    const IconSearch = () => {
        return (
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
        )
    }

    return (
        <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-center">
            <div className="max-w-lg w-full lg:max-w-xs relative" id="search-container">
                <label htmlFor="search" className="sr-only">
                    Search
                </label>
                <div className="relative">
                    <IconSearch />
                    <input
                        id="search"
                        name="search"
                        className="transition-all duration-75 ease-in-out block w-full pl-10 pr-3 py-2 border border-transparent rounded-md leading-5 bg-gray-700 dark:bg-[#0d0c0f] text-gray-300 dark:text-white placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-[#1a161f] focus:border-white dark:focus:border-gray-500 focus:ring-white focus:text-gray-900 sm:text-sm"
                        placeholder="Search"
                        type="search"
                        autoComplete="off"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown} // Add key down event handler
                        onFocus={() => query !== "" ? setShowResults(true) : null}
                    />

                    {/* Search Results Container */}
                    {showResults && (
                        <div className="absolute max-h-[500px] overflow-scroll top-full left-0 right-0 mt-2 bg-gray-800 dark:bg-[#121212] rounded-md shadow-lg w-full max-w-lg">
                            <ul className="text-white">
                                {results.length > 0 ? (
                                    results.map((item, index) => (
                                        <Link key={index} href={item.media_type === "movie" ? routes.movie(item.id) : routes.tvShow(item.id)}>
                                            <li className="p-3 hover:bg-gray-700 dark:hover:bg-zinc-900 flex gap-5">
                                                <Image 
                                                    src={`https://image.tmdb.org/t/p/w300/${item.poster_path || item.backdrop_path}` || "/404Poster"} 
                                                    alt={item.title || item.original_name} 
                                                    width={100} 
                                                    height={100}
                                                    className="w-20 rounded-md" 
                                                />
                                                <span className="">
                                                    {item.title || item.original_name}
                                                    <p className="text-xs opacity-80">{item.release_date || ''}</p>
                                                    <p className="text-xs opacity-80">{item.media_type || ''}</p>
                                                </span>
                                            </li>
                                        </Link>
                                    ))
                                ) : (
                                    <li className="p-2">No results found</li>
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