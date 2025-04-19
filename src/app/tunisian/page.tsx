"use client";
import React, { useState, useEffect } from 'react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/src/components/ui/carousel"
// import Link from 'next/link';
import { useRouter } from 'next/navigation'
import MoviePosterCard, { SkeletonLoader as PosterSkeletonLoader } from '@/src/components/MoviePosterCard'
// import routes from '@/src/routes/client/routes';

export default function Page() {
  const router = useRouter()

  type TunisianData = {
    title: string;
    image: string;
    link: string;
  };

  const [tunisianData, setTunisianData] = useState<TunisianData[]>();
  const [loader, setLoader] = useState(true)

  useEffect(() => {
    async function fetchData(){
        const response = await fetch('/api/tunisian');
        const data = await response.json();
        console.log(data);
        setTunisianData(data.results)
        setLoader(false)
    }
    fetchData();
  }, []);

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

  const getEpisodes = (link, router) => {
    router.push(`/tunisian/episodes?link=${encodeURIComponent(link)}`)
  }

  const SmallSliders = ({ data }: { data: any }) => {
    return (
      <div className='ml-5'>
        <p className='text-2xl sm:text-3xl font-semibold mb-3'>Tunisian Vibes</p>
        <div className='flex flex-wrap'>
          {
            tunisianData && data?.map((movie, index) => {
              return (
                <div key={index} className="transition-transform ease-in-out duration-400 select-none w-[200px]
               md:basis-[167px] my-4 p-0 ml-4 hover:scale-110 hover:z-10 ">
                  <div onClick={() => getEpisodes(movie.link, router)}>
                    <MoviePosterCard key={index} posterImg={movie.image} title={movie.title} externalImg={true} />
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>
    )
  }

    
  return (
    <div>
       {loader ?
        <SmallSkeleton /> : <SmallSliders data={tunisianData} />}
    </div>
  );
}
