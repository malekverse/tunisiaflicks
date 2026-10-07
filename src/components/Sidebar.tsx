"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaCog } from 'react-icons/fa';
import { FiSun, FiMoon } from 'react-icons/fi';
import { GiTunisia } from 'react-icons/gi';
import { IoClose } from 'react-icons/io5';
import {
    MdHome, MdOutlineHome,
    MdExplore, MdOutlineExplore,
    MdAlarm, MdOutlineAlarm,
    MdAccessTimeFilled, MdAccessTime,
    MdFavorite, MdFavoriteBorder,
    MdBookmark, MdBookmarkBorder,
    MdOutlineStar, MdOutlineStarBorder,
} from 'react-icons/md';

import { globalStore } from '@/src/store/store';

const ICON = 'text-xl shrink-0';

const sidebarElem = [
    { title: 'Home', DefIcon: <MdHome className={ICON} />, OutIcon: <MdOutlineHome className={ICON} />, path: '/' },
    { title: 'Tunisian', DefIcon: <GiTunisia className={ICON} />, OutIcon: <GiTunisia className={ICON} />, path: '/tunisian' },
    { title: 'Discovery', DefIcon: <MdExplore className={ICON} />, OutIcon: <MdOutlineExplore className={ICON} />, path: '/discover' },
    { title: 'Coming Soon', DefIcon: <MdAlarm className={ICON} />, OutIcon: <MdOutlineAlarm className={ICON} />, path: '/upcoming' },
    { title: 'Top Rated', DefIcon: <MdOutlineStar className={ICON} />, OutIcon: <MdOutlineStarBorder className={ICON} />, path: '/top-rated' },
    { title: 'Recent', DefIcon: <MdAccessTimeFilled className={ICON} />, OutIcon: <MdAccessTime className={ICON} />, path: '/history' },
    { title: 'Favorites', DefIcon: <MdFavorite className={ICON} />, OutIcon: <MdFavoriteBorder className={ICON} />, path: '/favorites' },
    { title: 'Bookmarked', DefIcon: <MdBookmark className={ICON} />, OutIcon: <MdBookmarkBorder className={ICON} />, path: '/saved' },
];

const itemBase = 'flex items-center w-full rounded-xl p-4 transition-colors duration-200 overflow-hidden whitespace-nowrap';

function SidebarContent({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
    const pathname = usePathname();
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const isDark = mounted && resolvedTheme === 'dark';
    const label = (text: string) => (
        <span className={`ml-3 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>{text}</span>
    );
    const layout = expanded ? 'pl-8 pr-4' : 'justify-center';

    return (
        <>
            <nav aria-label="Primary" className="flex flex-col gap-1 px-2 py-2">
                {sidebarElem.map((item) => {
                    const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            title={expanded ? undefined : item.title}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={onNavigate}
                            className={`${itemBase} ${layout} ${isActive
                                ? 'text-red-600 font-bold hover:text-white hover:bg-red-500'
                                : 'text-gray-300 hover:text-white hover:bg-zinc-800'}`}
                        >
                            {isActive ? item.DefIcon : item.OutIcon}
                            {label(item.title)}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto flex flex-col gap-1 px-2 py-2">
                <Link
                    href="/profile"
                    title={expanded ? undefined : 'Settings'}
                    onClick={onNavigate}
                    className={`${itemBase} ${layout} text-gray-300 hover:text-white hover:bg-zinc-800`}
                >
                    <FaCog className={ICON} />
                    {label('Settings')}
                </Link>
                <button
                    type="button"
                    title={expanded ? undefined : isDark ? 'Light Mode' : 'Dark Mode'}
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className={`${itemBase} ${layout} text-gray-300 hover:text-white hover:bg-zinc-800`}
                >
                    {isDark ? <FiSun className={ICON} /> : <FiMoon className={ICON} />}
                    {label(isDark ? 'Light Mode' : 'Dark Mode')}
                </button>
            </div>
        </>
    );
}

const Sidebar = () => {
    const pathname = usePathname();
    const expanded = globalStore((state) => state.sidebarExpanded);
    const toggleSidebar = globalStore((state) => state.toggleSidebar);
    const mobileOpen = globalStore((state) => state.mobileMenuOpen);
    const setMobileOpen = globalStore((state) => state.setMobileMenuOpen);

    // Restore the remembered desktop state after mount (avoids a hydration mismatch).
    useEffect(() => {
        globalStore.persist.rehydrate();
    }, []);

    // Close the mobile drawer whenever the route changes.
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname, setMobileOpen]);

    // Escape closes the drawer, and the page behind it doesn't scroll while it is open.
    useEffect(() => {
        if (!mobileOpen) return;
        const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileOpen, setMobileOpen]);

    return (
        <>
            {/*
              Desktop: a real flex column of the page layout. It is `sticky` under the navbar and
              its width transition pushes <main> (flex-1), so the content grows and shrinks with it.
            */}
            <aside
                aria-label="Sidebar"
                className={`hidden sm:flex shrink-0 flex-col sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden no-scrollbar bg-gray-800 dark:bg-black text-white transition-[width] duration-300 ease-in-out ${expanded ? 'w-64' : 'w-20'}`}
            >
                <div className="px-2 pt-2">
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                        aria-expanded={expanded}
                        className="w-full flex items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-600 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                        <span className={`transform scale-75 transition-transform duration-300 ${expanded ? '' : 'rotate-180'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </span>
                    </button>
                </div>
                <SidebarContent expanded={expanded} />
            </aside>

            {/* Mobile: slide-over drawer */}
            <div
                className={`sm:hidden fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
            />
            <aside
                aria-label="Menu"
                aria-hidden={!mobileOpen}
                className={`sm:hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto no-scrollbar bg-gray-800 dark:bg-black text-white shadow-2xl transition-[transform,visibility] duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full invisible'}`}
            >
                <div className="flex justify-end p-2">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close menu"
                        className="rounded-lg p-2 text-gray-300 hover:bg-zinc-800 hover:text-white"
                    >
                        <IoClose className="text-2xl" />
                    </button>
                </div>
                <SidebarContent expanded onNavigate={() => setMobileOpen(false)} />
            </aside>
        </>
    );
};

export default Sidebar;
