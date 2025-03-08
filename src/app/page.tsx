"use client"
import React, { useState, useEffect } from 'react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/src/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { FaLongArrowAltRight } from "react-icons/fa";
import Link from 'next/link';
import Genres from '@/src/components/Genres';
import MoviePosterCard, { SkeletonLoader as PosterSkeletonLoader } from '@/src/components/MoviePosterCard'
import MovieBackdropCard, { SkeletonLoader as BackdropSkeletonLoader } from '@/src/components/MovieBackdropCard';
import getMovies from './(movies)/actions';
import routes from '@/src/routes/client/routes';


const SkeletonBigSliders = () => {
  return (
    <Carousel className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%]'>
      <CarouselContent>
        {Array.from({ length: 10 }).map((_, index) => (
          <CarouselItem key={index} className="transition-transform ease-in-out duration-400 select-none basis-[300px]
           sm:basis-[400px] my-4 lg:basis-[500px] hover:scale-110 hover:border-2 border-black hover:z-10 pl-0 ml-4 shadow-black shadow-2xl">
            <BackdropSkeletonLoader />
          </CarouselItem>))}
      </CarouselContent>
    </Carousel>
  )
}

const BigSliders = ({ data }: { data: any }) => {
  return (
    <>
      <div className='flex justify-between w-full sm:w-[90%] lg:w-[96%] xl:w-[97%]'>
        <p className='text-2xl sm:text-3xl font-semibold mb-3' >Trending Movies</p>
        <Link href={'/'} className='text-gray-400 hover:text-white'>
          <p className='text-sm font-light inline-block mb-3 mr-2' >See More </p>
          <FaLongArrowAltRight className='inline-block' />
        </Link>
      </div>
      <Carousel
        plugins={[
          Autoplay({
            delay: 5000,
          }),
        ]}
        className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%]'>
        <CarouselContent>
          {
            data && data.results.map((movie) => {
              return (
                <CarouselItem key={movie.id} className="transition-transform ease-in-out duration-400 select-none basis-[300px]
               sm:basis-[400px] my-4 lg:basis-[500px] hover:scale-110 hover:border-2 border-black hover:z-10 pl-0 ml-4 shadow-black shadow-2xl">
                  <MovieBackdropCard key={movie.id} backdropImg={movie.backdrop_path} voteAverage={movie.vote_average} title={movie.title} releaseDate={movie.release_date} adult={movie.adult} link={routes.movie(movie.id)} />
                </CarouselItem>
              )
            })}
        </CarouselContent>
        <div className='hidden sm:block'>
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </Carousel>
    </>
  )
}

const SmallSkeleton = () => {
  return (
    <Carousel className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%]'>
      <CarouselContent>
        {Array.from({ length: 10 }).map((_, index) => (
          <CarouselItem key={index} className="transition-transform ease-in-out duration-400 select-none basis-[145px]
    md:basis-[167px] my-4 p-0 ml-4 hover:scale-110 hover:z-10">
            <PosterSkeletonLoader />
          </CarouselItem>))}
      </CarouselContent>
    </Carousel>
  )
}

const SmallSliders = ({ data }: { data: any }) => {
  return (
    <>
      <p className='text-2xl sm:text-3xl font-semibold mb-3'>Popular Movies</p>
      <Carousel className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%]'>
        <CarouselContent>
          {
            data && data.results.map((movie) => {
              return (
                <CarouselItem key={movie.id} className="transition-transform ease-in-out duration-400 select-none basis-[145px]
               md:basis-[167px] my-4 p-0 ml-4 hover:scale-110 hover:z-10">
                  <MoviePosterCard key={movie.id} posterImg={movie.poster_path} voteAverage={movie.vote_average} title={movie.title} releaseDate={movie.release_date} adult={movie.adult} link={routes.movie(movie.id)} />
                </CarouselItem>
              )
            })}
        </CarouselContent>
        <div className='hidden sm:block'>
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </Carousel>
    </>
  )
}

export default function MainPage() {

  const [data, setData] = useState(null)
  const [loader, setLoader] = useState(true)

  useEffect(() => {
    async function fetchMovies() {
      try {
        const moviesData = await getMovies()
        setData(moviesData)
        setLoader(false)
        console.log(moviesData)
      } catch (error) {
        console.error("Error fetching movies:", error)
        setLoader(false)
      }
    }

    fetchMovies()
  }, [])

  return (
    <div className='w-full p-4'>
      <Genres />
      <br />
      <div className='sm:ml-10'>
        {loader ? <SkeletonBigSliders /> : <BigSliders data={data?.TrendingMovies} />}
        <br />
        {loader ? <SmallSkeleton /> : <SmallSliders data={data?.popularMovies} />}
        <br />
        {loader ? <SmallSkeleton /> : <SmallSliders data={data?.topRatedMovies} />}
        <br />
        {loader ? <SmallSkeleton /> : <SmallSliders data={data?.nowPlayingMovies} />}
        <br />
        {loader ? <SmallSkeleton /> : <SmallSliders data={data?.upcomingMovies} />}
      </div>
    </div >
  )
}