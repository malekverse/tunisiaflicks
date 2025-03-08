"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { IoMdLogIn } from "react-icons/io";
// import { RiLoginCircleFill } from "react-icons/ri";
import { BiSearchAlt2 } from "react-icons/bi";
import { BiSolidSearchAlt2 } from "react-icons/bi";
import { GoHome } from "react-icons/go";
import { GoHomeFill } from "react-icons/go";
import { BiMoviePlay } from "react-icons/bi";
import { BiSolidMoviePlay } from "react-icons/bi";
import { BiTv } from "react-icons/bi";
import { BiSolidTv } from "react-icons/bi";
import { TbMenu2 } from "react-icons/tb";
import { globalStore } from '@/src/store/store';
import SearchBar from './SearchBar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar"

const Navbar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (session?.user?.id) {
      // Fetch user data from the API route
      fetch(`/api/user?userId=${session.user.id}`)
        .then((response) => response.json())
        .then((data) => {
          if (data.user) {
            console.log(userData)
            setUserData(data.user);
          }
        })
        .catch((error) => {
          console.error('Error fetching user data:', error);
        });
    }
  }, [session]);

  useEffect(() => {
    const handleContextMenu = (event) => {
      event.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const mobileNav = [
    { name: 'Home', href: '/', icon: <GoHome className='text-xl' />, activeIcon: <GoHomeFill className='text-xl text-red-500' /> },
    { name: 'Movies', href: '/movies', icon: <BiMoviePlay className='text-xl' />, activeIcon: <BiSolidMoviePlay className='text-xl text-red-500' /> },
    { name: 'Search', href: '/search', icon: <BiSearchAlt2 className='text-xl' />, activeIcon: <BiSolidSearchAlt2 className='text-xl text-red-500' /> },
    { name: 'TV Shows', href: '/tv', icon: <BiTv className='text-xl' />, activeIcon: <BiSolidTv className='text-xl text-red-500' /> },
  ];

  const asideState = globalStore((state: any) => state.fillWithSideBar);
  const updateAsideState = globalStore((state: any) => state.setFillWithSideBar);

  return (
    <nav>
      <div className="bg-gray-800 text-black shadow-md dark:shadow-none shadow-slate-800 fixed top-0 left-0 right-0 z-40 dark:bg-black dark:text-gray-200 dark:border-b-2 dark:border-gray-900">
        <div className="hidden sm:flex mx-auto px-2 sm:px-6 lg:px-8 justify-center">
          <div className="relative flex w-full items-center justify-between h-16 max-w-[2000px]">
            <div className="flex items-center mt">
              {/* Logo */}
              <Link href="/">
                <p className="flex-shrink-0">
                  <Image src="/A.svg" alt="Logo" width={40} height={40} />
                </p>
              </Link>
              {/* Links */}
              <div className="hidden sm:block sm:ml-6">
                <div className="flex space-x-4">
                  <Link href="/">
                    <p className={`${pathname == "/" ? "text-red-500" : ""} hover:bg-zinc-700 hover:text-white px-3 py-2 rounded-xl text-sm font-medium`}>
                      Movies
                    </p>
                  </Link>
                  <Link href="/tv">
                    <p className={`${pathname.startsWith("/tv") ? "text-red-500" : ""} text-gray-300 hover:bg-zinc-700 hover:text-white px-3 py-2 rounded-xl text-sm font-medium`}>
                      TV Shows
                    </p>
                  </Link>
                </div>
              </div>
            </div>
            {/* Search Bar */}
            {!pathname.startsWith("/search") ? <SearchBar /> : null}
            {/* User Profile or Login Button */}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Avatar>
                    <AvatarImage src={userData?.image || session.user?.image || ''} />
                    <AvatarFallback>{session.user?.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => redirect('/profile')}>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant='default' className='bg-red-500 text-white'>Login</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Top mobile navbar */}
        <div className='sm:hidden p-3 flex gap-4'>
          <TbMenu2 className='text-2xl text-white' onClick={() => updateAsideState(!asideState)} />
          <div className='flex justify-center w-full pr-5'>
            <Image src="/TunisiaFlicks.svg" alt="Logo" width={150} height={50} />
          </div>
        </div>
      </div>

      {/* Bottom mobile navbar */}
      <div className="sm:hidden fixed bottom-0 text-white bg-black w-full py-1 z-50">
        <ul className='flex justify-evenly'>
          {mobileNav.map((item, index) => {
            const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={index} className="flex justify-center p-2">
                <Link href={item.href}>
                  {isActive ? item.activeIcon : item.icon}
                </Link>
              </li>
            );
          })}
          {session ? (
            <li className="flex justify-center p-2">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Avatar className='w-5 h-5'>
                    <AvatarImage src={userData?.image || session.user?.image || ''} />
                    <AvatarFallback>{session.user?.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ) : (
            <li className="flex justify-center p-2">
              <Link href="/login">
                <IoMdLogIn className='text-xl' />
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

