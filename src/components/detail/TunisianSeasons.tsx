"use client"
import React, { useId, useState } from 'react'
import { m } from 'framer-motion'
import { ExternalLink, Play } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import type { TunisianSeason } from '@/src/lib/tunisian'
import { useT } from '@/src/components/I18nProvider'

/** A Tunisian series' seasons as a segmented control, and that season's episodes as tiles. */
export default function TunisianSeasons({ seasons }: { seasons: TunisianSeason[] }) {
  const t = useT()
  const pillId = useId()
  const [active, setActive] = useState(seasons[0].season)
  const current = seasons.find((season) => season.season === active) ?? seasons[0]

  return (
    <section aria-label={t('tv.episodes')}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[21px] font-bold sm:text-[26px]">{t('tv.episodes')}</h2>
        {seasons.length > 1 && (
          <div role="tablist" aria-label={t('tv.seasons')} className="no-scrollbar flex max-w-full overflow-x-auto overflow-y-hidden rounded-full bg-white/[0.07] p-1">
            {seasons.map((season) => {
              const selected = season.season === current.season
              return (
                <button
                  key={season.season}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(season.season)}
                  className={cn('relative h-9 shrink-0 rounded-full px-4 text-[14px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500', selected ? 'text-black' : 'text-white/70 hover:text-white')}
                >
                  {selected && <m.span layoutId={`tn-season-${pillId}`} transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
                  <span className="relative">{t('tunisian.season', { number: season.season })}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {current.episodes.map((episode) => (
          <a
            key={episode.url}
            href={episode.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group pressable flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3.5 text-[14px] font-medium text-white/85 ring-1 ring-white/[0.07] transition-colors duration-200 hover:bg-white/[0.1] hover:text-white"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-600 text-white transition-transform duration-200 group-hover:scale-110">
              <Play aria-hidden className="ms-0.5 h-3.5 w-3.5 fill-current rtl:-scale-x-100" />
            </span>
            <span dir="auto" className="min-w-0 flex-1 truncate">{episode.label}</span>
          </a>
        ))}
      </div>
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/40"><ExternalLink aria-hidden className="h-3.5 w-3.5" />{t('tunisian.sourceNote')}</p>
    </section>
  )
}
