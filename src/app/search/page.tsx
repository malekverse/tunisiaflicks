"use client";
import React, { useEffect, useState } from 'react'
import { searchMovies } from './actions';
import PosterCard from '@/src/components/PosterCard'
import routes from '@/src/routes/client/routes';

import PaginationComponent from '@/src/components/PaginationComponent';

export default function Page({searchParams}) {
  const [query, setQuery] = useState(searchParams.q || "");
  const [data, setData] = useState({});
  const [results, setResults] = useState([]);
  const [loader, setLoader] = useState(true);
  const [adult, setAdult] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchSearchData() {
      try {
        const searchResults = await searchMovies(query, adult, page)
        setData(searchResults)
        setResults(searchResults.results)
        setTotalPages(searchResults.total_pages)
        setLoader(false)
        console.log(searchResults)
      } catch (error) {
        console.error("Error fetching search results:", error)
        setLoader(false)
      }
    }

    fetchSearchData()
  }, [query, adult, page])

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }

  return (
    <div className='flex flex-col min-h-[calc(80vh)] w-full md:mx-10'>
      <div className='flex-grow'>
        {/* search bar */}
        <div className="">
          <div className="w-full ">
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
                placeholder="Search"
                autoComplete="off"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus={true}
              />
            </div>
          </div>
        </div>
        {/* Content */}
        <div className='flex flex-col items-center justify-center mt-5'>
              <div className='flex gap-4 flex-wrap justify-start mx-5 w-fit'>
                {results.map((item, index) => (
                  <PosterCard
                    key={index} posterImg={item.poster_path || item.backdrop_path } title={item.title || item.original_title} voteAverage={item.vote_average || 0} releaseDate={item.release_date || '..........'} link={item.media_type === "movie" ? routes.movie(item.id) : routes.tvShow(item.id)}
                  />
                ))}
            </div>
        </div>
      </div>

      {/* Pagination */}
      {results.length > 0 && (
        <div className="mt-8 mb-4">
          <PaginationComponent currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  )
}

