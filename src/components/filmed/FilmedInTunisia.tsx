"use client"
// /filmed-in-tunisia (lib/filmed-in-tunisia): Tunisia drawn as a map with a pin on every place a
// film was shot, and beside it (below, on a phone) each place: what was filmed there, the films,
// and how to get there. A pin and its place light up together; choosing one brings the other into
// view. Maps don't mirror: the map stays left to right in Arabic too.
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, MapPin, Navigation } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { useI18n } from '@/src/components/I18nProvider'
import { DJERBA, MAP_HEIGHT, MAP_WIDTH, OUTLINE, mapsLink, pathOf, project, textIn, type FilmedPlace } from '@/src/lib/filmed-in-tunisia'
import { cn } from '@/src/lib/utils'

export type FilmedFilmCard = { id: number, title: string, year: string, backdrop: string | null, poster: string | null }

export default function FilmedInTunisia({ places, films }: { places: FilmedPlace[], films: Record<number, FilmedFilmCard> }) {
  const { t, locale } = useI18n()
  const [active, setActive] = useState<string | null>(null)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})

  const choose = (id: string, from: 'map' | 'list') => {
    setActive(id)
    if (from === 'map') cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // A link to /filmed-in-tunisia#ajim opens on that place.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (places.some((place) => place.id === id)) setActive(id)
  }, [places])

  return (
    <div className="page-top pb-16">
      <div className="page-x">
        <div className="mx-auto max-w-[1200px]">
          <header className="max-w-[60ch]">
            <h1 className="text-balance font-display text-[clamp(34px,5vw,60px)] font-extrabold leading-[0.95]">{t('filmed.title')}</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-white/65">{t('filmed.subtitle')}</p>
          </header>

          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            {/* The map: sticky beside the places on a wide screen. */}
            <div className="lg:sticky lg:top-[calc(var(--topbar)+24px)] lg:self-start">
              <figure dir="ltr" className="mx-auto max-w-[260px] rounded-[26px] sm:max-w-[340px] lg:max-w-[420px] bg-gradient-to-b from-sky-950/40 to-white/[0.02] p-4 ring-1 ring-inset ring-white/[0.07]">
                <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={t('filmed.mapAria')} className="mx-auto h-auto max-h-[44vh] w-full lg:max-h-[70vh]">
                  <defs>
                    <linearGradient id="tn-land" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="rgb(255 255 255 / 0.10)" />
                      <stop offset="1" stopColor="rgb(234 179 8 / 0.10)" />
                    </linearGradient>
                  </defs>
                  <path d={pathOf(OUTLINE)} fill="url(#tn-land)" stroke="rgb(255 255 255 / 0.35)" strokeWidth={1.5} strokeLinejoin="round" />
                  <path d={pathOf(DJERBA)} fill="url(#tn-land)" stroke="rgb(255 255 255 / 0.35)" strokeWidth={1.5} strokeLinejoin="round" />
                  {places.map((place) => {
                    const [x, y] = project(place.lat, place.lon)
                    const on = active === place.id
                    return (
                      <a
                        key={place.id}
                        href={`#${place.id}`}
                        onClick={(event) => { event.preventDefault(); choose(place.id, 'map') }}
                        onMouseEnter={() => setActive(place.id)}
                        aria-label={textIn(place.name, locale)}
                        className="cursor-pointer outline-none [&:focus-visible>circle:last-child]:stroke-white"
                      >
                        {/* A finger-sized target around the small pin. */}
                        <circle cx={x} cy={y} r={16} fill="transparent" />
                        {on && <circle cx={x} cy={y} r={14} fill="rgb(239 68 68 / 0.25)" className="motion-safe:animate-ping [transform-box:fill-box] [transform-origin:center]" />}
                        <circle cx={x} cy={y} r={on ? 7.5 : 5.5} fill={on ? 'rgb(239 68 68)' : 'rgb(255 255 255 / 0.9)'} stroke="rgb(0 0 0 / 0.6)" strokeWidth={2} className="transition-all duration-200" />
                      </a>
                    )
                  })}
                </svg>
                <figcaption className="mt-2 text-center text-[13px] text-white/55">
                  {active ? textIn(places.find((place) => place.id === active)!.name, locale) : t('filmed.mapHint')}
                </figcaption>
              </figure>
            </div>

            <ol className="space-y-4">
              {places.map((place) => (
                <li
                  key={place.id}
                  id={place.id}
                  ref={(node) => { cardRefs.current[place.id] = node }}
                  onMouseEnter={() => setActive(place.id)}
                  className={cn('scroll-mt-[calc(var(--topbar)+24px)] rounded-[22px] p-4 ring-1 ring-inset transition-colors sm:p-5', active === place.id ? 'bg-white/[0.07] ring-red-500/40' : 'bg-white/[0.035] ring-white/[0.07]')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-[21px] font-bold leading-tight text-white">{textIn(place.name, locale)}</h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-white/55"><MapPin aria-hidden className="h-3.5 w-3.5" />{textIn(place.area, locale)}</p>
                    </div>
                    <button type="button" onClick={() => choose(place.id, 'list')} aria-pressed={active === place.id} className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-white/60 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden">
                      {t('filmed.onMap')}
                    </button>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {place.films.map((entry) => {
                      const film = films[entry.tmdb]
                      return (
                        <li key={entry.tmdb}>
                          <Link href={`/movie/${film.id}`} className="group flex gap-3.5 rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                            <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-[12px] bg-white/[0.06] sm:w-40">
                              <TmdbImage kind="backdrop" path={film.backdrop} alt="" name={film.title} fill sizes="160px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[15px] font-semibold text-white group-hover:underline group-hover:underline-offset-4">
                                <bdi dir="auto">{film.title}</bdi>{film.year && <span className="ms-2 font-normal text-white/50">{film.year}</span>}
                              </span>
                              <span className="mt-1 block text-[14px] leading-relaxed text-white/70">{textIn(entry.scene, locale)}</span>
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3">
                    <p className="flex items-start gap-2 text-[13.5px] leading-relaxed text-white/60"><Navigation aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />{textIn(place.visit, locale)}</p>
                    <a href={mapsLink(place)} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-white/75 underline-offset-4 hover:text-white hover:underline">
                      {t('filmed.directions')}<ExternalLink aria-hidden className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <p className="mt-10 text-center text-[13.5px] text-white/50">
            {t('filmed.mistake')} <Link href="/contact" className="text-white/75 underline underline-offset-4 hover:text-white">{t('filmed.tellUs')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
