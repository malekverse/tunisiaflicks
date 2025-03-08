"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaCog, FaMoon } from 'react-icons/fa';
import { MdHome, MdOutlineHome, MdExplore, MdOutlineExplore, MdGroup, MdOutlineGroup, MdAlarm, MdOutlineAlarm, MdAccessTimeFilled, MdAccessTime, MdFavorite, MdFavoriteBorder, MdBookmark, MdBookmarkBorder, MdOutlineStar, MdOutlineStarBorder } from "react-icons/md";

import { useTheme } from 'next-themes'
import { FiSun, FiMoon } from "react-icons/fi"

import { globalStore } from '@/src/store/store';

const Sidebar = () => {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const [mounted, setMounted] = useState(false)
    const { setTheme, resolvedTheme } = useTheme()

    useEffect(() =>  setMounted(true), [])

    const asideState = globalStore((state:any) => state.fillWithSideBar);

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const sidebarElem = [
        {
            title: "Home",
            DefIcon: <MdHome className="text-xl" />,
            OutIcon: <MdOutlineHome className="text-xl" />,
            path: "/",
            localStorageName: "home",
            child: [
                { title: "movies", path: "/movies" },
                { title: "tv", path: "/movies" },
            ]
        },
        {
            title: "Discovery",
            DefIcon: <MdExplore className="text-xl" />,
            OutIcon: <MdOutlineExplore className="text-xl" />,
            path: "/discover",
            localStorageName: "discover"
        },
        {
            title: "Community",
            DefIcon: <MdGroup className="text-xl" />,
            OutIcon: <MdOutlineGroup className="text-xl" />,
            path: "/community",
            localStorageName: "community"
        },
        {
            title: "Coming Soon",
            DefIcon: <MdAlarm className="text-xl" />,
            OutIcon: <MdOutlineAlarm className="text-xl" />,
            path: "/upcoming",
            localStorageName: "upcoming"
        },
        {
            title: "Recent",
            DefIcon: <MdAccessTimeFilled className="text-xl" />,
            OutIcon: <MdAccessTime className="text-xl" />,
            path: "/recent",
            localStorageName: "recent"
        },
        {
            title: "Favorites",
            DefIcon: <MdFavorite className="text-xl" />,
            OutIcon: <MdFavoriteBorder className="text-xl" />,
            path: "/favorites",
            localStorageName: "favorites",
        },
        {
            title: "Bookmarked",
            DefIcon: <MdBookmark className="text-xl" />,
            OutIcon: <MdBookmarkBorder className="text-xl" />,
            path: "/bookmarked",
            localStorageName: "bookmarked"
        },
        {
            title: "Top Rated",
            DefIcon: <MdOutlineStar className="text-xl" />,
            OutIcon: <MdOutlineStarBorder className="text-xl" />,
            path: "/top-rated",
            localStorageName: "topRated"
        },
    ];

    useEffect(() => {
        if (asideState) {
          setIsOpen(true);
        }
      }, [asideState]);

    return (
        <div className={`bg-gray-800 text-white w-0 ${asideState ? `w-screen pt-6 ${isOpen ? 'sm:w-72' : 'sm:w-20'}` : isOpen ? 'sm:w-72' : 'sm:w-20'} transition-all absolute sm:relative duration-300 overflow-scroll ease-in-out z-30 h-screen`}>
        <div className={`bg-gray-800 text-white w-0 ${asideState ? `w-screen pt-6 ${isOpen ? 'sm:w-64' : 'sm:w-20'}` : isOpen ? 'sm:w-64' : 'sm:w-20'} sm:flex transition-all fixed top-0 left-0 duration-300 overflow-auto ease-in-out flex-col justify-between dark:bg-black light:text-gray-200 z-30 pt-16 h-screen scroll no-scrollbar`}>
            <div className="flex flex-col items-center">
                <button
                    onClick={toggleSidebar}
                    className={`absolute scale-90 right-0 ${asideState ? 'hidden' : 'flex'} mt-2 bg-zinc-900 text-white rounded-lg focus:outline-none w-full flex items-center justify-center transform transition-transform duration-300 hover:bg-zinc-600`}
                >
                    <span className={`transform scale-75 transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </span>
                </button>
                <nav className="mt-8 flex flex-col items-center space-y-4 w-full overflow-hidden">
                    <div className='flex-col flex justify-center w-full'>
                        {sidebarElem.map((item, index) => {
                            if (asideState) {
                                if(item.title == "Home"){
                                    return null
                                }
                            }
                            const isActive = item.path === "/" ? pathname === item.path : pathname.startsWith(item.path);
                            return (
                                <Link key={index + item.title} href={item.path} className={`flex  ${isActive ? "text-red-600 font-bold hover:text-white hover:bg-red-500" : "text-gray-300 hover:text-white hover:bg-zinc-800"} items-center w-full ${isOpen ? 'pl-10' : 'justify-center'} my-2 p-4 rounded-xl transition-colors duration-200`}>
                                    {item.DefIcon}
                                    <span className={`ml-3 ${isOpen ? 'block' : 'hidden'}`}>{item.title}</span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </div>
            <div>
                <div className={`flex p-4 ${isOpen ? 'pl-10' : 'justify-center'} hover:bg-zinc-800 transition-colors duration-200 cursor-pointer`}>
                    <FaCog className="text-xl" />
                    <span className={`ml-3 ${isOpen ? 'block' : 'hidden'}`}>Settings</span>
                </div>
                <div onClick={() => resolvedTheme === 'dark' ? setTheme('light') : setTheme('dark')
                } className={`flex p-4 ${isOpen ? 'pl-10' : 'justify-center'} hover:bg-zinc-800 transition-colors duration-200 cursor-pointer`}>
                    {resolvedTheme === 'dark' ? <FiSun className="text-xl" /> : <FiMoon className="text-xl" />}
                    <span className={`ml-3 ${isOpen ? 'block' : 'hidden'}`}> {resolvedTheme === 'dark' ? "Light Mode" : "Dark Mode"}</span>
                </div>
            </div>
        </div>
    </div>
    );
};

export default Sidebar;
