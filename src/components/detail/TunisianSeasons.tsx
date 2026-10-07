"use client"
import React, { useState } from 'react'
import { FaPlay } from 'react-icons/fa6'
import { cn } from '@/src/lib/utils'
import type { TunisianSeason } from '@/src/lib/tunisian'

export default function TunisianSeasons({ seasons }: { seasons: TunisianSeason[] }) {
  const [active, setActive] = useState(seasons[0].season)
  const current = seasons.find((season) => season.season === active) ?? seasons[0]

  return (
    <section aria-label="Episodes">
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar" role="tablist" aria-label="Seasons">
        {seasons.map((season) => (
          <button
            key={season.season}
            type="button"
            role="tab"
            aria-selected={season.season === current.season}
            onClick={() => setActive(season.season)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-xl text-sm font-medium",
              season.season === current.season ? "bg-red-500 text-white" : "bg-zinc-800 text-gray-300 hover:bg-zinc-600 hover:text-white"
            )}
          >
            Season {season.season}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 mt-2" dir="ltr">
        {current.episodes.map((episode) => (
          <a
            key={episode.url}
            href={episode.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-3 py-4 text-sm font-medium text-gray-200 hover:bg-red-500 hover:text-white transition-colors"
          >
            <FaPlay className="text-xs" /> <span dir="auto">{episode.label}</span>
          </a>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-500">Episodes open on the source site in a new tab.</p>
    </section>
  )
}
