"use client";

import React, { useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

function HorizontalScroller({ children }: any) {
    const menuRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (menuRef.current) {
            const scrollAmount = 200; // Amount of pixels to scroll by
            if (direction === 'left') {
                menuRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else if (direction === 'right') {
                menuRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    };

    const handleWheel = (event: WheelEvent) => {
        if (menuRef.current) {
            const scrollAmount = 100; // Amount of pixels to scroll by on wheel
            if (event.deltaY < 0) {
                menuRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else if (event.deltaY > 0) {
                menuRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }

            // Prevent the outer page from scrolling when the mouse is over the HorizontalScroller
            event.preventDefault();
        }
    };

    useEffect(() => {
        const menuElement = menuRef.current;
        if (menuElement) {
            menuElement.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            if (menuElement) {
                menuElement.removeEventListener('wheel', handleWheel);
            }
        };
    }, []);

    return (
        <div className="relative flex overflow-hidden">
            <Button
                variant='link'
                className="bg-transparent absolute top-1/2 left-0 transform -translate-y-1/2 p-2 focus:outline-none text-white"
                onClick={() => scroll('left')}
            >
                <FaChevronLeft />
            </Button>

            <div
                ref={menuRef}
                className="overflow-auto whitespace-nowrap gap-3 flex w-full mx-8 no-scrollbar"
            >
                {children}
            </div>

            <Button
                variant='link'
                className="bg-transparent absolute top-1/2 right-0 transform -translate-y-1/2 p-2 focus:outline-none text-white"
                onClick={() => scroll('right')}
            >
                <FaChevronRight />
            </Button>
        </div>
    );
}

export default HorizontalScroller;