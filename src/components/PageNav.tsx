"use client"
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import PaginationComponent from '@/src/components/PaginationComponent'

/** Pagination for server-rendered list pages: keeps the other query params, changes `?page=`. */
export default function PageNav({ currentPage, totalPages }: { currentPage: number, totalPages: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  return (
    <div className='mt-8 mb-4'>
      <PaginationComponent
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => {
          if (page < 1 || page > totalPages) return
          const params = new URLSearchParams(searchParams.toString())
          params.set('page', String(page))
          router.push(`${pathname}?${params.toString()}`)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </div>
  )
}
