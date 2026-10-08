"use client"
import React, { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, RotateCcw, Users } from 'lucide-react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Select, SelectContent, SelectItem } from '@/src/components/ui/select'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'
import type { TKey } from '@/src/lib/i18n'

export type DiscoverFilterValues = { genre?: string, year?: string, rating?: string, sort: string, runtime?: string, family?: string }

const ANY = 'any'

const SORTS: { value: string, label: TKey }[] = [
  { value: 'popular', label: 'filters.popular' },
  { value: 'top', label: 'filters.top' },
  { value: 'newest', label: 'filters.newest' },
]

const RATINGS = ['6', '7', '8']

const RUNTIMES: { value: string, label: TKey }[] = [
  { value: '90', label: 'filters.runtime90' },
  { value: '120', label: 'filters.runtime120' },
  { value: 'epic', label: 'filters.runtimeEpic' },
]

const pill = 'pressable inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500'
const idle = 'border border-white/10 bg-white/[0.04] text-white/80 hover:border-white/25 hover:bg-white/[0.08] hover:text-white'
const on = 'border border-white bg-white text-black'

/** A filter as a pill that opens a list; white once a value is chosen. */
function FilterSelect({ label, value, options, onChange, anyLabel }: {
  label: string
  value?: string
  options: { value: string, label: string }[]
  onChange: (value: string) => void
  anyLabel?: string
}) {
  const current = options.find((option) => option.value === value)
  return (
    <Select value={value ?? ANY} onValueChange={(next) => onChange(next === ANY ? '' : next)}>
      <SelectPrimitive.Trigger aria-label={label} className={cn(pill, current && anyLabel ? on : idle)}>
        <span className="max-w-[160px] truncate">{current?.label ?? anyLabel ?? label}</span>
        <ChevronDown aria-hidden className="h-4 w-4 opacity-60" />
      </SelectPrimitive.Trigger>
      <SelectContent className="max-h-[320px]">
        {anyLabel && <SelectItem value={ANY}>{anyLabel}</SelectItem>}
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

/** Filter bar for /discover. Every change updates the URL (shareable) and restarts at page 1. */
export default function DiscoverFilters({ genres, values }: { genres: { id: number, name: string }[], values: DiscoverFilterValues }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT()
  const [pending, startTransition] = useTransition()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear + 1 - 1950 + 1 }, (_, i) => String(currentYear + 1 - i))

  const navigate = (params: URLSearchParams) => {
    startTransition(() => router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false }))
  }

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    navigate(params)
  }

  const active = [values.genre, values.year, values.rating, values.runtime, values.family].filter(Boolean).length + (values.sort !== 'popular' ? 1 : 0)

  return (
    <div className="page-x" aria-busy={pending}>
      <div role="group" aria-label={t('filters.aria')} className="no-scrollbar -mx-[var(--gutter)] flex items-center gap-2 overflow-x-auto overflow-y-hidden px-[var(--gutter)] pb-1">
        <FilterSelect
          label={t('filters.sortBy')}
          value={values.sort}
          onChange={(value) => update('sort', value === 'popular' ? '' : value)}
          options={SORTS.map((option) => ({ value: option.value, label: t(option.label) }))}
        />
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/15" />
        <FilterSelect
          label={t('filters.genre')}
          anyLabel={t('filters.allGenres')}
          value={values.genre}
          onChange={(value) => update('genre', value)}
          options={genres.map((genre) => ({ value: String(genre.id), label: genre.name }))}
        />
        <FilterSelect
          label={t('filters.year')}
          anyLabel={t('filters.anyYear')}
          value={values.year}
          onChange={(value) => update('year', value)}
          options={years.map((year) => ({ value: year, label: year }))}
        />
        <FilterSelect
          label={t('filters.minRating')}
          anyLabel={t('filters.anyRating')}
          value={values.rating}
          onChange={(value) => update('rating', value)}
          options={RATINGS.map((rating) => ({ value: rating, label: t('filters.minStars', { rating }) }))}
        />
        <FilterSelect
          label={t('filters.runtime')}
          anyLabel={t('filters.anyRuntime')}
          value={values.runtime}
          onChange={(value) => update('runtime', value)}
          options={RUNTIMES.map((option) => ({ value: option.value, label: t(option.label) }))}
        />
        <button
          type="button"
          aria-pressed={values.family === '1'}
          onClick={() => update('family', values.family === '1' ? '' : '1')}
          className={cn(pill, values.family === '1' ? on : idle)}
        >
          <Users aria-hidden className="h-4 w-4" />
          {t('filters.family')}
        </button>
        {active > 0 && (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams()
              const type = searchParams.get('type')
              if (type) params.set('type', type)
              navigate(params)
            }}
            className={cn(pill, 'text-white/55 hover:text-white')}
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            {t('filters.reset', { count: active })}
          </button>
        )}
      </div>
    </div>
  )
}
