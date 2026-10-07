"use client"
import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useT } from '@/src/components/I18nProvider'
import type { TKey } from '@/src/lib/i18n'

export type DiscoverFilterValues = { genre?: string, year?: string, rating?: string, sort: string }

const SORTS: { value: string, label: TKey }[] = [
  { value: 'popular', label: 'filters.popular' },
  { value: 'top', label: 'filters.top' },
  { value: 'newest', label: 'filters.newest' },
]

const RATINGS = ['6', '7', '8']

const selectClass =
  'h-10 rounded-xl bg-zinc-800 text-gray-200 text-sm ps-3 pe-8 border border-transparent hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500'

/** Filter bar for /discover. Every change updates the URL (shareable) and restarts at page 1. */
export default function DiscoverFilters({ genres, values }: { genres: { id: number, name: string }[], values: DiscoverFilterValues }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT()

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
    <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label={t('filters.aria')}>
      <select aria-label={t('filters.genre')} className={selectClass} value={values.genre ?? ''} onChange={(e) => update('genre', e.target.value)}>
        <option value="">{t('filters.allGenres')}</option>
        {genres.map((genre) => <option key={genre.id} value={String(genre.id)}>{genre.name}</option>)}
      </select>
      <select aria-label={t('filters.year')} className={selectClass} value={values.year ?? ''} onChange={(e) => update('year', e.target.value)}>
        <option value="">{t('filters.anyYear')}</option>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
      <select aria-label={t('filters.minRating')} className={selectClass} value={values.rating ?? ''} onChange={(e) => update('rating', e.target.value)}>
        <option value="">{t('filters.anyRating')}</option>
        {RATINGS.map((rating) => <option key={rating} value={rating}>{t('filters.minStars', { rating })}</option>)}
      </select>
      <select aria-label={t('filters.sortBy')} className={selectClass} value={values.sort} onChange={(e) => update('sort', e.target.value === 'popular' ? '' : e.target.value)}>
        {SORTS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
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
          {t('filters.reset', { count: active })}
        </button>
      )}
    </div>
  )
}
