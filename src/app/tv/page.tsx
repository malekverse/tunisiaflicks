"use client"
import React, { useState, useEffect } from 'react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/src/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { FaLongArrowAltRight } from "react-icons/fa";
import Link from 'next/link';
import Genres from '@/src/components/Genres';
import TVPosterCard, { SkeletonLoader as PosterSkeletonLoader } from '@/src/components/TVPosterCard'
import MovieBackdropCard, { SkeletonLoader as BackdropSkeletonLoader } from '@/src/components/MovieBackdropCard';
import getTVShows from './actions';
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
        <p className='text-2xl sm:text-3xl font-semibold mb-3' >Trending TV Shows</p>
        <Link href={'/tv'} className='text-gray-400 hover:text-white'>
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
            data && data.results.map((show) => {
              return (
                <CarouselItem key={show.id} className="transition-transform ease-in-out duration-400 select-none basis-[300px]
               sm:basis-[400px] my-4 lg:basis-[500px] hover:scale-110 hover:border-2 border-black hover:z-10 pl-0 ml-4 shadow-black shadow-2xl">
                  <MovieBackdropCard key={show.id} backdropImg={show.backdrop_path} voteAverage={show.vote_average} title={show.name} releaseDate={show.first_air_date} adult={show.adult} link={routes.tvShow(show.id)} />
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

const SmallSliders = ({ data, title }: { data: any, title: string }) => {
  return (
    <>
      <p className='text-2xl sm:text-3xl font-semibold mb-3'>{title}</p>
      <Carousel className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%]'>
        <CarouselContent>
          {
            data && data.results.map((show) => {
              return (
                <CarouselItem key={show.id} className="transition-transform ease-in-out duration-400 select-none basis-[145px]
               md:basis-[167px] my-4 p-0 ml-4 hover:scale-110 hover:z-10">
                  <TVPosterCard key={show.id} posterImg={show.poster_path} voteAverage={show.vote_average} title={show.name} releaseDate={show.first_air_date} adult={show.adult} link={routes.tvShow(show.id)} />
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

export default function TVPage() {
  const [tvData, setTVData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTVShows();
        setTVData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching TV data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className='flex flex-col items-center justify-center w-full'>
      <Genres type="tv"/>
      <div className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%] mt-5'>
        <h1 className='text-3xl sm:text-4xl font-bold mb-5'>TV Shows</h1>
      </div>
      
      {loading ? <SkeletonBigSliders /> : <BigSliders data={tvData?.trendingTVShows} />}
      
      <div className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%] mt-10'>
        {loading ? <SmallSkeleton /> : <SmallSliders data={tvData?.popularTVShows} title="Popular TV Shows" />}
      </div>
      
      <div className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%] mt-10'>
        {loading ? <SmallSkeleton /> : <SmallSliders data={tvData?.topRatedTVShows} title="Top Rated TV Shows" />}
      </div>
      
      <div className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%] mt-10'>
        {loading ? <SmallSkeleton /> : <SmallSliders data={tvData?.onTheAirTVShows} title="Currently Airing TV Shows" />}
      </div>
      
      <div className='w-full sm:w-[90%] lg:w-[96%] xl:w-[97%] mt-10 mb-10'>
        {loading ? <SmallSkeleton /> : <SmallSliders data={tvData?.airingTodayTVShows} title="TV Shows Airing Today" />}
      </div>
    </div>
  )
}
