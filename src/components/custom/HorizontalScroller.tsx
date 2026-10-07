"use client";

import React, { useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useT } from "../I18nProvider";

function HorizontalScroller({ children }: { children: React.ReactNode }) {
    const menuRef = useRef<HTMLDivElement>(null);
    const t = useT();

    // Physical directions on purpose: the left arrow always moves the strip left, in LTR and RTL.
    const scroll = (direction: 'left' | 'right') => {
        menuRef.current?.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' });
    };

    const arrow = "absolute top-1/2 -translate-y-1/2 z-10 p-2 rounded-full text-zinc-700 dark:text-white hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500";

    return (
        <div className="relative flex overflow-hidden">
            <button type="button" aria-label={t('common.scrollLeft')} className={`${arrow} left-0`} onClick={() => scroll('left')}>
                <FaChevronLeft />
            </button>

            {/* Swipe on touch, shift+wheel / trackpad on desktop, arrows everywhere. The wheel is
                deliberately not hijacked, so the page keeps scrolling when the pointer is over it. */}
            <div
                ref={menuRef}
                className="overflow-x-auto whitespace-nowrap gap-3 flex w-full mx-8 no-scrollbar"
            >
                {children}
            </div>

            <button type="button" aria-label={t('common.scrollRight')} className={`${arrow} right-0`} onClick={() => scroll('right')}>
                <FaChevronRight />
            </button>
        </div>
    );
}

export default HorizontalScroller;
