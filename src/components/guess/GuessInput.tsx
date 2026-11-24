"use client"
// The guess box: type a film's name, pick it from the list (arrow keys and Enter work), or skip to
// the next clue. Live results 250ms after the last key; a film already tried can't be picked again.
// Guess the actor uses it for people (`people`): their faces, and what they're known for.
import React, { useEffect, useId, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { Search, SkipForward } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { searchGuessFilms, searchGuessPeople } from '@/src/app/guess/actions'
import type { Candidate } from '@/src/lib/guess'
import { cn } from '@/src/lib/utils'

export default function GuessInput({ tried, triesLeft, onGuess, onSkip, people = false }: {
  tried: number[]
  triesLeft: number
  onGuess: (film: Candidate) => void
  onSkip: () => void
  /** Search people instead of films (Guess the actor). */
  people?: boolean
}) {
  const t = useT()
  const id = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      (people ? searchGuessPeople : searchGuessFilms)(trimmed)
        .then((found) => { if (!cancelled) setResults(found) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, people])

  // Close the list when the focus or a tap goes elsewhere.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const choose = (film: Candidate) => {
    if (tried.includes(film.id)) return
    onGuess(film)
    setQuery('')
    setResults([])
    setOpen(false)
    input.current?.blur()
  }

  // On a phone the keyboard takes half the screen: bring the box up so the list fits above it.
  const onFocus = () => {
    setOpen(true)
    if (window.matchMedia('(max-width: 767px)').matches) {
      setTimeout(() => {
        const top = (box.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 76
        window.scrollTo({ top, behavior: 'smooth' })
      }, 250)
    }
  }

  const showList = open && trimmed.length >= 2

  return (
    <div ref={box} className="relative">
      <Command shouldFilter={false} label={t('guess.input.label')} className="relative">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/50" />
            <Command.Input
              ref={input}
              id={`${id}-input`}
              value={query}
              onValueChange={(value) => { setQuery(value); setOpen(true) }}
              onFocus={onFocus}
              onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}
              placeholder={t(people ? 'guessActor.input.placeholder' : 'guess.input.placeholder')}
              autoComplete="off"
              enterKeyHint="search"
              className="h-[52px] w-full rounded-full bg-white/[0.07] pe-4 ps-11 text-[16px] text-white outline-none ring-1 ring-inset ring-white/10 transition-shadow placeholder:text-white/45 focus:ring-2 focus:ring-red-500"
            />
          </div>
          <Button type="button" variant="secondary" className="h-[52px] shrink-0 px-5" onClick={onSkip} aria-label={t('guess.skipAria')}>
            <SkipForward aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
            <span className="hidden sm:inline">{t('guess.skip')}</span>
          </Button>
        </div>

        {showList && (
          <Command.List className="glass-strong absolute inset-x-0 top-full z-30 mt-2 max-h-[min(360px,50dvh)] overflow-y-auto overscroll-contain rounded-[20px] p-1.5 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.95)]">
            {loading && results.length === 0 && <Command.Loading><p className="px-3 py-3 text-[14px] text-white/60">{t('common.loading')}</p></Command.Loading>}
            {!loading && <Command.Empty><p className="px-3 py-3 text-[14px] text-white/60">{t(people ? 'guessActor.input.empty' : 'guess.input.empty')}</p></Command.Empty>}
            {results.map((film) => {
              const done = tried.includes(film.id)
              return (
                <Command.Item
                  key={film.id}
                  value={String(film.id)}
                  disabled={done}
                  onSelect={() => choose(film)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-[14px] p-2 outline-none data-[selected=true]:bg-white/[0.1]', done && 'cursor-default opacity-50')}
                >
                  <span className={cn('relative shrink-0 overflow-hidden bg-white/[0.06]', people ? 'h-10 w-10 rounded-full' : 'aspect-[2/3] w-9 rounded-[6px]')}>
                    <TmdbImage kind={people ? 'profile' : 'poster'} path={film.poster_path} alt="" name={film.title} fill sizes="40px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <bdi dir="auto" className="block truncate text-[15px] font-medium text-white">{film.title}</bdi>
                    <span className="flex gap-x-3 text-[12.5px] text-white/55">
                      {film.year && <span>{film.year}</span>}
                      {film.note && <bdi dir="auto" className="truncate">{film.note}</bdi>}
                      {done && <span>{t('guess.input.tried')}</span>}
                    </span>
                  </span>
                </Command.Item>
              )
            })}
          </Command.List>
        )}
      </Command>
      <p className="mt-2.5 px-1 text-[13px] text-white/55" aria-live="polite">
        {triesLeft === 1 ? t('guess.lastTry') : t('guess.triesLeft', { count: triesLeft })}
      </p>
    </div>
  )
}
