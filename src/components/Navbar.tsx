"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { IoMdLogIn } from "react-icons/io";
import { BiSearchAlt2, BiSolidSearchAlt2, BiTv, BiSolidTv } from "react-icons/bi";
import { MdExplore, MdOutlineExplore } from "react-icons/md";
import { GoHome, GoHomeFill } from "react-icons/go";
import { TbMenu2 } from "react-icons/tb";
import { GiPerspectiveDiceSixFacesRandom } from "react-icons/gi";
import { globalStore } from '@/src/store/store';
import SearchBar from './SearchBar';
import LanguageToggle from './LanguageToggle';
import { useT } from './I18nProvider';
import type { TKey } from '@/src/lib/i18n';
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

const mobileNav: { name: TKey, href: string, icon: React.ReactNode, activeIcon: React.ReactNode }[] = [
  { name: 'nav.home', href: '/', icon: <GoHome className='text-xl' />, activeIcon: <GoHomeFill className='text-xl text-red-500' /> },
  { name: 'nav.discover', href: '/discover', icon: <MdOutlineExplore className='text-xl' />, activeIcon: <MdExplore className='text-xl text-red-500' /> },
  { name: 'nav.search', href: '/search', icon: <BiSearchAlt2 className='text-xl' />, activeIcon: <BiSolidSearchAlt2 className='text-xl text-red-500' /> },
  { name: 'nav.tvShows', href: '/tv', icon: <BiTv className='text-xl' />, activeIcon: <BiSolidTv className='text-xl text-red-500' /> },
];

const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const t = useT();

  const [userImage, setUserImage] = useState<string | null>(null);
  const avatar = globalStore((state) => state.avatar);
  const setMobileMenuOpen = globalStore((state) => state.setMobileMenuOpen);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      setUserImage(null);
      return;
    }
    const controller = new AbortController();
    fetch('/api/user', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setUserImage(data?.user?.image || null))
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('Error fetching user data:', error);
      });
    return () => controller.abort();
  }, [userId]);

  const avatarSrc = avatar || userImage || session?.user?.image || '';

  const accountMenu = (
    <DropdownMenuContent>
      <DropdownMenuLabel>{t('nav.myAccount')}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => router.push('/profile')}>{t('nav.profile')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => router.push('/favorites')}>{t('nav.favorites')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => router.push('/saved')}>{t('nav.bookmarked')}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => signOut()}>{t('nav.logout')}</DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <nav>
      <div className="bg-gray-800 text-black shadow-md dark:shadow-none shadow-slate-800 fixed top-0 left-0 right-0 z-40 dark:bg-black dark:text-gray-200 dark:border-b-2 dark:border-gray-900">
        <div className="hidden sm:flex mx-auto px-2 sm:px-6 lg:px-8 justify-center">
          <div className="relative flex w-full items-center justify-between h-16 max-w-[2000px]">
            <div className="flex items-center">
              {/* Logo */}
              <Link href="/" aria-label={t('nav.homeAria')} className="flex-shrink-0">
                <Image src="/A.svg" alt="Logo" width={40} height={35} className="h-9 w-auto" priority />
              </Link>
              {/* Links */}
              <div className="hidden sm:block sm:ms-6">
                <div className="flex gap-4">
                  <Link href="/" className={`${pathname === "/" ? "text-red-500" : "text-gray-300"} hover:bg-zinc-700 hover:text-white px-3 py-2 rounded-xl text-sm font-medium`}>
                    {t('nav.movies')}
                  </Link>
                  <Link href="/tv" className={`${pathname.startsWith("/tv") ? "text-red-500" : "text-gray-300"} hover:bg-zinc-700 hover:text-white px-3 py-2 rounded-xl text-sm font-medium`}>
                    {t('nav.tvShows')}
                  </Link>
                  {/* Plain <a>: a fresh random pick on every click (no prefetch / router cache). */}
                  <a href="/surprise" title={t('nav.surpriseTitle')} className="flex items-center gap-1.5 text-gray-300 hover:bg-zinc-700 hover:text-white px-3 py-2 rounded-xl text-sm font-medium">
                    <GiPerspectiveDiceSixFacesRandom className="text-base" /> {t('nav.surprise')}
                  </a>
                </div>
              </div>
            </div>
            {/* Search Bar */}
            {!pathname.startsWith("/search") ? <SearchBar /> : <div className="flex-1" />}
            <div className="flex items-center gap-3">
              <LanguageToggle />
              {/* User Profile or Login Button */}
              {session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={t('nav.accountMenu')} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                    <Avatar>
                      <AvatarImage src={avatarSrc} />
                      <AvatarFallback>{session.user?.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  {accountMenu}
                </DropdownMenu>
              ) : (
                <Link href="/login">
                  <Button variant='default' className='bg-red-500 text-white'>{t('nav.login')}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Top mobile navbar */}
        <div className='sm:hidden h-14 px-3 flex items-center gap-4'>
          <button type="button" aria-label={t('nav.openMenu')} onClick={() => setMobileMenuOpen(true)} className="text-white">
            <TbMenu2 className='text-2xl' />
          </button>
          <Link href="/" className='flex flex-1 justify-center pe-8'>
            <Image src="/TunisiaFlicks.svg" alt="TunisiaFlicks" width={160} height={21} className="h-6 w-auto" priority />
          </Link>
        </div>
      </div>

      {/* Bottom mobile navbar */}
      <div className="sm:hidden fixed bottom-0 text-white bg-black w-full py-1 z-40">
        <ul className='flex justify-evenly'>
          {mobileNav.map((item) => {
            const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={item.href} className="flex justify-center p-2">
                <Link href={item.href} aria-label={t(item.name)}>
                  {isActive ? item.activeIcon : item.icon}
                </Link>
              </li>
            );
          })}
          {session ? (
            <li className="flex justify-center p-2">
              <DropdownMenu>
                <DropdownMenuTrigger aria-label={t('nav.accountMenu')}>
                  <Avatar className='w-5 h-5'>
                    <AvatarImage src={avatarSrc} />
                    <AvatarFallback>{session.user?.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                {accountMenu}
              </DropdownMenu>
            </li>
          ) : (
            <li className="flex justify-center p-2">
              <Link href="/login" aria-label={t('nav.login')}>
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
