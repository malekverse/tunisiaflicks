"use client";
import React, { useEffect, useState, useCallback } from 'react'
import getMovieData, { getSimilarMovieData, getSeasonDetails, getEpisodeDetails } from './actions'

import { EmblaOptionsType } from 'embla-carousel'
import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import './carousel.style.css'
import { FaHeart } from "react-icons/fa6";
import { Button } from 'src/components/ui/button';
import { FaPlay } from "react-icons/fa6";
import { cn } from "@/src/lib/utils"
import { FaBookmark } from "react-icons/fa";
import { FaShareAlt } from "react-icons/fa";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/src/components/ui/carousel';
import { HiOutlineArrowsExpand } from "react-icons/hi";



function Page({ params }: { params: { id: string } }) {
  const [epNumber, setEpNumber] = useState<any>({})

  const streamServices = [
    {
      // https://www.2embed.cc/
      // https://www.2embed.skin/
      name: '2embed.cc',
      url: `https://www.2embed.skin/embedtvfull/${params.id}/${epNumber.season_number}/${epNumber.episode_number}`
    },
    {
      // https://www.superembed.stream/#install
      name: 'MultiEmbed',
      url: `https://multiembed.mov/?video_id=${params.id}&tmdb=1`
    },
    {
      // https://2embed.pro
      name: '2embed.pro',
      url: `https://2embed.pro/embed/movie/${params.id}`
    },
  ]

  const [data, setData] = useState(null)
  const [backdrops, setBackdrops] = useState([])
  const [logos, setLogos] = useState([])
  const [loader, setLoader] = useState(true)

  const [similar, setSimilar] = useState(null)
  const [similarLoader, setSimilarLoader] = useState(true)
  
  const [episodes, setEpisodes] = useState<{ episodes: any, name: string }>({ episodes: [], name: '' })
  console.log('episodes:', episodes)
  console.log('epNumber:', epNumber)
  const OPTIONS: EmblaOptionsType = { loop: true }

  useEffect(() => {
    async function fetchMovieData() {
      try {
        const similar = await getSimilarMovieData(params.id)
        setSimilar(similar)
        setSimilarLoader(false)
        console.log('similar:', similar)
      } catch (error) {
        console.error("Error fetching movie:", error)
        setLoader(false)
      }
    }

    fetchMovieData()
  }, [params.id])

  useEffect(() => {
    async function fetchMovieData() {
      try {
        const moviesData = await getMovieData(params.id)
        setData(moviesData)
        setLoader(false)
        console.log(moviesData)
        setBackdrops(moviesData.images.backdrops)
        setLogos(moviesData.images.logos)
      } catch (error) {
        console.error("Error fetching movie:", error)
        setLoader(false)
      }
    }

    fetchMovieData()
  }, [params.id])


  const handleWatchNow = () => {
    // Implement watch now functionality
  };

  const handleWatchTrailer = () => {
    // Implement watch trailer functionality
  };

  const handleAddToFavorites = () => {
    // Implement add to favorites functionality
  };

  const handleSaveForLater = () => {
    // Implement save for later functionality
  };

  const handleShare = () => {
    // Implement share functionality
  };

  // return (loader ? <div>Hello</div> : <div>{data.backdrop_path}</div>)


  return (
    loader
      ?
      <div className='w-full h-96 bg-gray-800 animate-pulse' />
      :
      <div className='w-full h-full -mt-6 relative' >
        <div className='absolute h-full w-full'>
          <div className='h-1/2 md:h-[calc(100%-20vh)] w-full relative'>
            <BackdropsCarousel slides={backdrops} options={OPTIONS} />
            <div className='absolute bottom-0 h-1/2 md:h-2/6 w-full' style={{ background: 'linear-gradient(transparent, #0d0c0f)' }} />
            <div className='hidden md:block absolute left-0 bottom-0 h-full w-1/2' style={{ background: 'linear-gradient(to left, transparent, #0d0c0f)' }} />
            <div className='w-full h-full absolute left-0 bottom-0' />

            <div className='absolute pl-5 pr-5 md:pr-0 md:pl-10 top-8 w-full h-full'>
              <div>
                <div className='w-full md:w-full lg:w-2/3 h-full' >
                  <Image src={`https://image.tmdb.org/t/p/original${logos.filter((item) => item.iso_639_1 == 'en')[0].file_path || logos[0].file_path}`} className='w-32 md:w-40' width={500} height={100} alt="Movie LOGO" />

                  <div className='flex justify-center items-center gap-5 mt-44 flex-col md:mt-96 md:flex-row'>
                    <Image src={`https://image.tmdb.org/t/p/original${data.poster_path}`} className='w-40 md:w-44 rounded-xl' width={500} height={100} alt="Movie LOGO" />

                    <div className='flex flex-col '>
                      <p className='flex flex-col md:flex-row items-center flex-wrap gap-3 '>
                        {/* {Array(data.origin_country) ? 'is array' : "Hello"} */}
                        <div>
                          {data.origin_country.map((item, index) => (
                            <Image className='inline-block' key={index} src={`https://flagsapi.com/${item}/flat/32.png`} width={32} height={32} alt={item} />
                          ))}
                        </div>
                        {/* <Image src={`https://flagsapi.com/${data.origin_country[0] || data.origin_country}/flat/32.png`} width={32} height={32} alt='slm' /> */}
                        <p>
                          <p className='flex gap-1 items-center'><FaHeart className='text-red-500' />
                            <p className='text-red-500 font-bold'>{Math.round(data.vote_average * 10)}%</p> Likes</p>
                        </p>
                        <p className='hidden md:block'>•</p>
                        <p className='hidden md:block'>{data.first_air_date.substring(0, 4)} - {data.last_air_date.substring(0, 4)}</p>
                        <p className='block md:hidden'>{data.release_date}</p>
                        {
                          data.adult &&
                          <div className='flex gap-3'>
                            <p className='hidden md:block'>•</p>
                            <p className='bg-red-500 px-3 rounded-xl'>+18</p>
                          </div>
                        }
                        <p className='hidden md:block'>•</p>
                        {data.genres.map((item, index) => data.genres.length - 1 !== index ? item.name + ", " : item.name)}
                      </p>

                      <p className='mt-3 text-gray-300 text-center md:text-start'>{data.overview}</p>

                      <div className='mt-3 '>
                        <div className=''>
                          <p>CASTS:</p>
                          <div className='flex justify-center md:justify-start gap-2 mt-2 select-none flex-wrap'>
                            {data.credits.cast.slice(0, 7).map((item, index) => (
                              <div className='flex gap-3 items-center cursor-pointer' key={index}>
                                <Image src={item.profile_path === null ? '/actor.png' : `https://image.tmdb.org/t/p/w300${item.profile_path}`} title={item.name} className='w-12 h-12 md:w-14 md:h-14 object-cover rounded-full' style={{ objectPosition: '0 30%' }} width={100} height={100} alt={item.name} />
                              </div>
                            ))}
                            <div className='w-12 h-12 md:w-14 md:h-14 bg-gray-500 bg-opacity-40 border-opacity-70 border-2 border-gray-200 rounded-full text-wrap text-center text-xs flex items-center justify-center cursor-pointer' >
                              <HiOutlineArrowsExpand className='w-6 h-6 md:w-8 md:h-8' />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='flex gap-4 mt-6 flex-wrap justify-center md:justify-start'>
                        <div className='flex justify-center items-center gap-3'>
                          <Button onClick={handleWatchNow} className='text-white-500 bg-red-500 hover:bg-red-400'>
                            <FaPlay className="mr-1" /> Watch Now
                          </Button>
                          <Button onClick={handleWatchTrailer} variant='outline' className='border-white bg-transparent'>
                            Watch Trailer
                          </Button>
                        </div>
                        <div className='flex justify-center items-center gap-3'>
                          <InteractiveButton clicked={handleAddToFavorites} icon={<FaHeart className='w-5 h-5' />} title="Add to Favories" titleled="Favorited!" />
                          <div className='mx-2 group cursor-pointer'><FaBookmark className='w-5 h-5 group-hover:scale-110' /></div>
                          <div className='group cursor-pointer'><FaShareAlt className='w-5 h-5 group-hover:scale-110' /></div>
                          {/* <InteractiveButton clicked={handleSaveForLater} icon={<FaBookmark className='w-5 h-5' />} title="Save for Later" titleled="Saved!" /> */}
                          {/* <InteractiveButton clicked={handleShare} icon={<FaShareAlt className='w-5 h-5' />} title="Share" titleled="Shared" /> */}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <br />

                {/* Recommendations */}
                <TvShowSeasonsCarousel setEpisodesParent={setEpisodes} id={data.id} data={data.seasons} />

                {/* Episodes */}
                {episodes.episodes.length > 0 && <Episodes id={data.id} selectedSeasons={episodes} setEpNumberParent={setEpNumber} episodes={episodes} />}

                <WatchEpisode id={data.id} epNumber={epNumber} streamServices={streamServices} similar={similar} />


                <SimilarMoviesCarousel similar={similar} />

                <br />
                <br />
                <br />

              </div>

            </div>

          </div>

        </div>
      </div>
  )
}

const WatchEpisode = ({ id, epNumber, streamServices, similar }) => {
  return (
    <div className='w-full h-[50vh] md:h-[80vh] md:pr-5' id='watchSection'>
      <div className='flex gap-3 flex-wrap py-1 pl-2  bg-red-500 rounded-t-lg'>
        {streamServices.map((item, index) => (
          <div key={index} className='cursor-pointer px-1 rounded-md text-white-500 bg-red-500 hover:bg-red-400'>
            {item.name}
          </div>
        ))}
      </div>
      <iframe src={streamServices[0].url} className='w-full h-[80%] md:h-full' allowFullScreen></iframe>
    </div>
  )
}


const Episodes = ({ id, episodes, setEpNumberParent, selectedSeasons }) => {
  const [selectedEpisodeNum, setSelectedEpisodeNum] = useState(null)
  const fetchMovieData = async (id, selectedEpisode) => {
    try {
      console.log(id, selectedSeasons.season_number, selectedEpisode);
      const episodesData = await getEpisodeDetails(id, selectedSeasons.season_number, selectedEpisode);
      setEpNumberParent(episodesData);
      console.log(episodesData);
    } catch (error) {
      console.error("Error fetching movie:", error);
    }
  };

  useEffect(() => {
    if (selectedEpisodeNum !== null) {
      fetchMovieData(id, selectedEpisodeNum);
      setSelectedEpisodeNum(null);
    }
  }, [id, selectedSeasons, selectedEpisodeNum]);

  const handleWatchEpisode = (id, season, episode) => {
    setSelectedEpisodeNum(episode);
  };

  return (
    <a href="#watchSection" id='episodesSection'>
    <div className='w-full'>
      <p className='md:ml-10 mb-8 text-2xl'>Episodes: {episodes.name}</p>
      <div className='flex gap-3 flex-wrap justify-center'>
        {episodes.episodes.map((item, index) => (
          <div key={index} title={item.overview} onClick={() => handleWatchEpisode(item.id, item.season_number, item.episode_number)}
            className='flex flex-col gap-3 items-center mt-3 cursor-pointer'>
            <Image src={`https://image.tmdb.org/t/p/w300${item.still_path}`} className=' rounded-md' width={300} height={300} alt={item.name} />
            <div className='flex flex-col gap-1'>
              <p className='font-semibold max-w-[300px]' title={item.name}>episode {item.episode_number}: {item.name}</p>
            </div>
          </div>
        ))}
      </div>
      <br />
    </div>
    </a>)
}


const TvShowSeasonsCarousel = ({ setEpisodesParent, id, data }) => {
  const fetchSeasonData = useCallback(async (seasonNumber) => {
    try {
      const episodesData = await getSeasonDetails(id, seasonNumber);
      setEpisodesParent(episodesData);
    } catch (error) {
      console.error("Error fetching season:", error);
    }
  }, [id, setEpisodesParent]);

  const handleFetchEpisodes = useCallback((season_number) => {
    fetchSeasonData(season_number);
  }, [fetchSeasonData]);

  return (
    <div>
      <p className='md:ml-10 -mb-[50px] text-2xl'>Seasons</p>
      <div className='flex justify-center'>
        <Carousel className='w-full sm:w-[88%]'
          plugins={[
            Autoplay({
              delay: 3000,
            }),
          ]}
        >
          <CarouselContent>
            {data.map((movie) => (
              <CarouselItem onClick={() => handleFetchEpisodes(movie.season_number)} key={movie.id} className="cursor-pointer transition-all ease-in-out duration-100 select-none basis-[145px] md:basis-[300px] my-4 p-0 ml-4 h-60 flex items-center group">
                <a href="#episodesSection">
                <div className={`w-[145px] h-[100px] md:w-[300px] md:h-[170px] bg-center bg-no-repeat bg-cover rounded-xl relative`}
                  title={movie.overview} style={{
                    backgroundImage: (movie.poster_path) !== null
                      ? `url('https://image.tmdb.org/t/p/w300${movie.poster_path}')`
                      : 'url(https://image.tmdb.org/t/p/w300/n4ycOGj2tRLfINTJQ3wl0vNYqpR.jpg)'
                  }} >
                  <div className='w-full h-full bg-gradient-to-t from-gray-950 opacity-70 to-transparent rounded-xl' />
                  <div className='hidden absolute right-2 top-2 md:group-hover:flex gap-1 text-[10px] '>
                    {movie.adult && <p className='bg-black font-semibold shadow-lg shadow-black px-[5px] text-red-500 py-[1px] rounded-3xl'>+18</p>}
                    <p className='bg-black font-semibold shadow-lg shadow-black px-[5px] py-[1px] rounded-3xl'>{movie.media_type}</p>
                  </div>
                  <div className='absolute bottom-8 left-2'>
                    <p className='text-xs md:text-sm font-semibold' title={movie.name}>{movie.name}</p>
                    <p className='text-[10px] '>{movie.release_date}</p>
                  </div>
                </div>
                </a>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className='hidden sm:block'>
            <CarouselPrevious />
            <CarouselNext />
          </div>
        </Carousel>
      </div>
    </div>
  );
};


const SimilarMoviesCarousel = ({ similar }) => {
  return (
    <div>
      <p className='md:ml-10 mt-16 -mb-[50px] text-2xl'>Recommended</p>
      <div className='flex justify-center transition-opacity delay-75 duration-150'>
        <Carousel className='w-full sm:w-[88%]'
          plugins={[
            Autoplay({
              delay: 3000,
            }),
          ]}
        >
          <CarouselContent>
            {
              similar.results.map((movie) => {
                return (
                  <CarouselItem key={movie.id} className="cursor-pointer transition-all ease-in-out duration-100 select-none basis-[145px] opacity-1 md:opacity-60
                         md:hover:opacity-100 md:basis-[224px] my-4 p-0 ml-4 md:hover:scale-150 md:hover:z-10 md:hover:-translate-y-8 h-60
                         md:hover:mr-16 md:hover:ml-20 flex items-center group">
                    <div className={`w-56 h-32 bg-center bg-no-repeat bg-cover rounded-xl relative`}
                      title={movie.overview} style={{
                        backgroundImage: (movie.backdrop_path || movie.poster_path) !== null
                          ? `url('https://image.tmdb.org/t/p/w300${movie.backdrop_path || movie.poster_path}')`
                          : 'url(https://image.tmdb.org/t/p/w300/n4ycOGj2tRLfINTJQ3wl0vNYqpR.jpg)'
                      }} >
                      <div className='w-full h-full md:group-hover:bg-gradient-to-t from-gray-950 to-transparent bg-opacity-50 rounded-xl' />
                      <div className='hidden absolute right-2 top-2 md:group-hover:flex gap-1 text-[10px] '>
                        {movie.adult && <p className=' bg-black font-semibold shadow-lg shadow-black px-[5px] text-red-500 py-[1px] rounded-3xl'>+18</p>}
                        <p className=' bg-black font-semibold shadow-lg shadow-black px-[5px] py-[1px] rounded-3xl'>{movie.media_type}</p>
                      </div>
                      <div className='md:hidden md:group-hover:block absolute bottom-8 left-2'>
                        <p className='text-sm font-semibold'>{movie.title || movie.original_title}</p>
                        <p className='text-[10px] md:opacity-80'>{movie.release_date}</p>
                      </div>
                    </div>
                  </CarouselItem>
                )
              })}
          </CarouselContent>
          <div className='hidden sm:block'>
            <CarouselPrevious />
            <CarouselNext />
          </div>
        </Carousel>
      </div>
    </div>
  );
}

const BackdropsCarousel = (props) => {
  const { slides, options } = props
  const [emblaRef, emblaApi] = useEmblaCarousel(options, [Autoplay({ delay: 3000 })])
  return (
    <section className="embla">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container">
          {slides.map((item, index) => (
            <div className="embla__slide h-full" key={index}>
              {/* <Image src={`https://image.tmdb.org/t/p/original${item.file_path}`} blurDataURL={`https://image.tmdb.org/t/p/300"${item.file_path}`} title={item.name} className='w-full h-full object-cover' style={{ objectPosition: '0 30%' }} width={100} height={100} alt={item.name} /> */}
              <div className='w-full h-full shadow-[inset 0 0 0 0.2rem var(--detail-medium-contrast)]'
                style={{
                  backgroundImage: `url(https://image.tmdb.org/t/p/original${item.file_path})`, backgroundPosition: 'top',
                  backgroundSize: 'cover', backgroundRepeat: 'no-repeat'
                }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
const InteractiveButton = ({ icon, title, titleled, clicked }: any) => {
  const [isActive, setIsActive] = useState(false)
  const handleClick = () => {
    setIsActive(!isActive)
    clicked()
  }

  return (
    <Button
      variant="outline"
      className={cn(
        "relative overflow-hidden group bg-transparent",
        "w-10 h-10 rounded-full border-white",
        "transition-all duration-75 ease-in-out",
        isActive ? "bg-red-500 text-primary-foreground md:hover:bg-red-500" : "bg-transparent md:hover:text-red-500 md:hover:border-red-500 md:hover:bg-transparent"
      )}
      onClick={() => handleClick()}
    >
      <span className={cn(
        "absolute inset-y-0 left-0 flex items-center justify-center",
        "w-10 h-10 transition-all duration-75 ease-in-out",
        "md:group-hover:scale-110"
      )}>
        <span className={cn(
          " -ml-[2px]",
          "transition-all duration-75 ease-in-out",
          isActive ? "text-white" : "stroke-current md:group-hover:fill-primary"
        )}>{icon}</span>
      </span>
      <span
        className={cn(
          "absolute left-10 opacity-0 transition-all duration-75 ease-in-out whitespace-nowrap",
          "md:group-hover:opacity-100"
        )}
      >
        {isActive ? titleled : title}
      </span>
    </Button>
  )
}

export default Page

