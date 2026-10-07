"use client"
import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Option = { value: string, label: string }

export type DiscoverFilterValues = { genre?: string, year?: string, rating?: string, sort: string }

const SORTS: Option[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'top', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
]

const RATINGS: Option[] = [
  { value: '', label: 'Any rating' },
  { value: '6', label: '6+ ★' },
  { value: '7', label: '7+ ★' },
  { value: '8', label: '8+ ★' },
]

const selectClass =
  'h-10 rounded-xl bg-zinc-800 text-gray-200 text-sm px-3 pr-8 border border-transparent hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500'

/** Filter bar for /discover. Every change updates the URL (shareable) and restarts at page 1. */
export default function DiscoverFilters({ genres, values }: { genres: { id: number, name: string }[], values: DiscoverFilterValues }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear + 1 - 1950 + 1 }, (_, i) => String(currentYear + 1 - i))

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  const active = [values.genre, values.year, values.rating].filter(Boolean).length + (values.sort !== 'popular' ? 1 : 0)

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label="Filters">
      <select aria-label="Genre" className={selectClass} value={values.genre ?? ''} onChange={(e) => update('genre', e.target.value)}>
        <option value="">All genres</option>
        {genres.map((genre) => <option key={genre.id} value={String(genre.id)}>{genre.name}</option>)}
      </select>
      <select aria-label="Year" className={selectClass} value={values.year ?? ''} onChange={(e) => update('year', e.target.value)}>
        <option value="">Any year</option>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
      <select aria-label="Minimum rating" className={selectClass} value={values.rating ?? ''} onChange={(e) => update('rating', e.target.value)}>
        {RATINGS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select aria-label="Sort by" className={selectClass} value={values.sort} onChange={(e) => update('sort', e.target.value === 'popular' ? '' : e.target.value)}>
        {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {active > 0 && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams()
            const type = searchParams.get('type')
            if (type) params.set('type', type)
            router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname)
          }}
          className="h-10 px-3 rounded-xl text-sm text-gray-400 hover:text-white"
        >
          Reset ({active})
        </button>
      )}
    </div>
  )
}
