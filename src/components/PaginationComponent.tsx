"use client";

import React from 'react';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/src/components/ui/pagination";
import { useMediaQuery } from '@/src/hooks/use-media-query';

interface PaginationComponentProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    maxVisiblePages?: number;
}

const PaginationComponent: React.FC<PaginationComponentProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    maxVisiblePages = 5
}) => {
    const isMobile = useMediaQuery("(max-width: 640px)");

    const getPageNumbers = () => {
        const pageNumbers = [];
        const halfVisible = Math.floor(maxVisiblePages / 2);
        let startPage = Math.max(currentPage - halfVisible, 1);
        let endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(endPage - maxVisiblePages + 1, 1);
        }

        if (isMobile) {
            // On mobile, show only current page, first, and last
            if (currentPage > 1) pageNumbers.push(1);
            if (currentPage > 2) pageNumbers.push('ellipsis');
            pageNumbers.push(currentPage);
            if (currentPage < totalPages - 1) pageNumbers.push('ellipsis');
            if (currentPage < totalPages) pageNumbers.push(totalPages);
        } else {
            if (startPage > 1) {
                pageNumbers.push(1);
                if (startPage > 2) {
                    pageNumbers.push('ellipsis');
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push(i);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pageNumbers.push('ellipsis');
                }
                pageNumbers.push(totalPages);
            }
        }

        return pageNumbers;
    };

    return (
        <Pagination>
            <PaginationContent className="flex-wrap justify-center">
                <PaginationItem>
                    <PaginationPrevious 
                        onClick={() => onPageChange(currentPage - 1)}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                </PaginationItem>
                {getPageNumbers().map((pageNumber, index) => (
                    <PaginationItem key={index}>
                        {pageNumber === 'ellipsis' ? (
                            <PaginationEllipsis />
                        ) : (
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onPageChange(pageNumber as number);
                                }}
                                isActive={currentPage === pageNumber}
                            >
                                {pageNumber}
                            </PaginationLink>
                        )}
                    </PaginationItem>
                ))}
                <PaginationItem>
                    <PaginationNext 
                        onClick={() => onPageChange(currentPage + 1)}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
};

export default PaginationComponent;