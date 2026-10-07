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
import NotificationBell from './NotificationBell';
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
import ProfileAvatar, { KidsBadge } from '@/src/components/profiles/ProfileAvatar';
import KidsUnlockDialog from '@/src/components/profiles/KidsUnlockDialog';
import { forgetProfile, selectProfile, useProfiles } from '@/src/hooks/use-profiles';
import { toast } from '@/src/hooks/use-toast';
import type { Profile } from '@/src/lib/models/Profile';

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

  // Viewer profiles: until one is picked on this device, send the user to "Who's watching?".
  const { data: profiles, active } = useProfiles();
  const [unlocking, setUnlocking] = useState<Profile | null>(null);
  const needsPick = profiles?.needsPick ?? false;
  useEffect(() => {
    if (needsPick && !/^\/(profiles|login|signup|auth)(\/|$)/.test(pathname)) {
      router.replace(`/profiles?next=${encodeURIComponent(pathname)}`);
    }
  }, [needsPick, pathname, router]);

  const switchTo = async (profile: Profile) => {
    if (!profile.kids && profiles?.locked) return setUnlocking(profile);
    const result = await selectProfile(profile.id);
    // Reload: every list, row and the catalogue itself depend on the profile.
    if (result.ok) window.location.reload();
    else if (result.needsPassword) setUnlocking(profile);
    else toast({ title: t('common.error'), description: t('profiles.switchFailed'), variant: "destructive" });
  };

  const logOut = async () => {
    await forgetProfile();
    signOut();
  };

  // The owner's profile (the first) keeps the account photo.
  const isOwner = !active || profiles?.profiles[0]?.id === active.id;
  const accountAvatar = (className?: string) => active ? (
    <ProfileAvatar profile={active} image={isOwner ? avatarSrc || null : null} size="md" className={className} />
  ) : (
    <Avatar className={className}>
      <AvatarImage src={avatarSrc} />
      <AvatarFallback>{session?.user?.name?.charAt(0) || 'U'}</AvatarFallback>
    </Avatar>
  );

  const otherProfiles = profiles?.profiles.filter((profile) => profile.id !== active?.id) ?? [];
  const accountMenu = (
    <DropdownMenuContent align="end" className="min-w-[200px]">
      <DropdownMenuLabel className="flex items-center gap-2">
        {active ? <>{active.name} {active.kids && <KidsBadge label={t('profiles.kidsBadge')} />}</> : t('nav.myAccount')}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {otherProfiles.map((profile) => (
        <DropdownMenuItem key={profile.id} onSelect={() => switchTo(profile)} className="gap-2">
          <ProfileAvatar profile={profile} size="sm" />
          <span className="truncate">{profile.name}</span>
          {profile.kids && <KidsBadge label={t('profiles.kidsBadge')} className="ms-auto" />}
        </DropdownMenuItem>
      ))}
      {active && !active.kids && (
        <DropdownMenuItem onSelect={() => router.push('/profile#profiles')}>{t('nav.manageProfiles')}</DropdownMenuItem>
      )}
      {profiles && <DropdownMenuSeparator />}
      <DropdownMenuItem onSelect={() => router.push('/profile')}>{t('nav.profile')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => router.push('/favorites')}>{t('nav.favorites')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => router.push('/saved')}>{t('nav.bookmarked')}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={logOut}>{t('nav.logout')}</DropdownMenuItem>
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
              <NotificationBell />
              {/* User Profile or Login Button */}
              {session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={t('nav.accountMenu')} className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                    {active?.kids && <KidsBadge label={t('profiles.kidsBadge')} />}
                    {accountAvatar()}
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
          <Link href="/" className='flex flex-1 justify-center'>
            <Image src="/TunisiaFlicks.svg" alt="TunisiaFlicks" width={160} height={21} className="h-6 w-auto" priority />
          </Link>
          {/* Same width as the menu button, so the logo stays centred. */}
          <div className='w-8 flex justify-end'>
            <NotificationBell className='p-1' />
          </div>
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
                  {accountAvatar(active ? 'h-5 w-5 rounded text-[10px]' : 'w-5 h-5')}
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

      <KidsUnlockDialog profile={unlocking} onClose={() => setUnlocking(null)} onUnlocked={() => window.location.reload()} />
    </nav>
  );
};

export default Navbar;
