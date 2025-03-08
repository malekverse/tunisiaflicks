import React from 'react'
import { IoMdStar } from "react-icons/io";
import Link from 'next/link';

export default function PosterCard({ posterImg, title, voteAverage, releaseDate, dropDown, link }:
     { dropDown?: any, posterImg: string, title: string, voteAverage: any, releaseDate: any, link?: string }) {
  return (
            <Link href={link || "/"}>
                <div className='w-[150px] h-[196px] sm:w-[170px] sm:h-[225px]  rounded-xl p-0 z-0 relative'
                    style={posterImg ? {
                        backgroundImage: `url(https://image.tmdb.org/t/p/w500${posterImg})`,
                        backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center'
                    }:
                    {
                        backgroundImage: "url('/404Poster')",
                        backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center'
                    }
                    } >
                    <div className='absolute left-0 top-0 w-full h-[216px] sm:h-[250px] z-10 bg-black opacity-10 transition-opacity ease-in-out duration-700 hover:opacity-0' />
                    {dropDown
                        ? <div className='absolute z-50 left-0 top-0 scale-50 sm:scale-100'>
                            {dropDown}
                        </div>
                        : <label className='absolute left-1 top-1 bg-gray-900 pb-1 px-2 rounded-xl scale-75 sm:scale-100'>
                            <IoMdStar className='inline-block mr-1 text-yellow-400' />
                            <p className="inline-block bbc-text-shadow p-0 text-xs">{voteAverage.toString().substring(0, 3)}</p>
                        </label>
                    }
                    <div className='absolute bottom-5 left-3'>
                        <p className='text-white text-sm sm:text-base font-semibold bbc-text-shadow'>{title}</p>
                        <p className='text-white text-xs sm:text-xs font-semibold bbc-text-shadow'>{releaseDate.substring(0, 4)}</p>
                    </div>
                </div>
            </Link>
  )
}
