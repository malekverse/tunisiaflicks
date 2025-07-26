"use client";
import React, { useState, useEffect, useCallback } from 'react';
import PaginationComponent from '@/src/components/PaginationComponent';
import PosterCard from '@/src/components/PosterCard';
import routes from '@/src/routes/client/routes';
import { Suspense } from 'react';

export default function Page({ params }: { params: { id: string } }) {
  const [data, setData] = useState([]);
  const [loader, setLoader] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMovies = useCallback(async (page: number) => {
    setLoader(true);
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/movie?api_key=b5d2609c326586f7f753f77b085a0b31&with_genres=${params.id}&page=${page}`
      );
      const data = await response.json();
      console.log(data)
      setData(data.results);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('Error fetching movies:', error);
    } finally {
      setLoader(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchMovies(currentPage);
  }, [currentPage, fetchMovies]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {loader ? (
        <p>Loading...</p>
      ) : (
        <div className='flex flex-col items-center justify-center'>
          <div className='ml-2'>
            <p className='my-3 text-xl ml-5'>Genres</p>
            <div className="mt-5 w-fit">
              <div className='flex gap-4 flex-wrap justify-start mx-5 w-fit'>
                {data.map((item, index) => (
                  <PosterCard
                    key={index}
                    posterImg={item.poster_path || item.backdrop_path || '/404Poster'}
                    title={item.title || item.original_title}
                    voteAverage={item.vote_average || 0}
                    releaseDate={item.release_date || '..........'}
                    link={routes.movie(item.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {data.length > 0 && (
            <div className="mt-8 mb-4">
              <PaginationComponent
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}
    </Suspense>
  );
}