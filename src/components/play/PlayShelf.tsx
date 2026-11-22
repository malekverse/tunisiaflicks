"use client"
// Home: "Can't pick a film?", every way to choose (PLAY_TOOLS) as a card, so nobody has to know
// the address. Guess the film says today's number and whether you've played it; Decide together
// how many nights the room has saved on this phone.
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { useT } from '@/src/components/I18nProvider'
import { isPlayableDay, outcome, puzzleNumber, tunisDay } from '@/src/lib/guess'
import { cn } from '@/src/lib/utils'
import { loadGames } from '@/src/components/guess/storage'
import { PLAY_TOOLS, isNewTool, type PlayTool } from './tools'

/** A short status under a card, read from this device (nothing for the others). */
function useStatus(): Record<string, string | null> {
  const t = useT()
  const [status, setStatus] = useState<Record<string, string | null>>({})
  useEffect(() => {
    const next: Record<string, string | null> = {}
    const today = tunisDay()
    if (isPlayableDay(today, today)) {
      const game = loadGames().find((entry) => entry.day === today)
      const result = game ? outcome(game.entries) : null
      const state = result === 'won' ? t('play.guess.found', { count: game!.entries.length })
        : result === 'lost' ? t('play.guess.missed')
          : result === 'playing' ? t('play.guess.started')
            : t('play.guess.notYet')
      next['/guess'] = `${t('guess.number', { n: puzzleNumber(today) })}|${state}`
    }
    try {
      const nights = JSON.parse(localStorage.getItem('tf-decide:nights:v1') ?? '[]')
      if (Array.isArray(nights) && nights.length) next['/decide'] = `|${t('play.decide.nights', { count: nights.length })}`
    } catch { /* nothing saved */ }
    setStatus(next)
  }, [t])
  return status
}

export function ToolCard({ tool, status, className }: { tool: PlayTool, status?: string | null, className?: string }) {
  const t = useT()
  const Icon = tool.icon
  const [lead, rest] = (status ?? '').split('|')
  return (
    <Link
      href={tool.href}
      className={cn(
        'group/tool pressable relative flex h-full min-h-[196px] flex-col overflow-hidden rounded-[22px] bg-white/[0.04] p-5 outline-none ring-1 ring-inset ring-white/[0.07] transition-colors duration-200 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500',
        className,
      )}
    >
      <Icon aria-hidden className="pointer-events-none absolute -bottom-6 -end-6 h-32 w-32 rotate-[-12deg] text-white/[0.04] transition-transform duration-500 ease-out group-hover/tool:rotate-0" strokeWidth={1.4} />
      <span className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white shadow-[0_10px_30px_-8px_rgb(229_15_5/0.6)]">
          <Icon aria-hidden className="h-[22px] w-[22px]" />
        </span>
        {isNewTool(tool) && <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-black">{t('play.new')}</span>}
      </span>
      <span className="mt-4 block font-display text-[21px] font-bold leading-tight text-white">{t(tool.label)}</span>
      <span className="mt-1 block text-[13.5px] leading-snug text-white/60">{t(tool.text)}</span>
      {status && (
        <span className="mt-auto flex flex-wrap gap-x-3 pt-3 text-[12.5px]">
          {lead && <span className="font-semibold text-white">{lead}</span>}
          {rest && <span className="text-white/60">{rest}</span>}
        </span>
      )}
    </Link>
  )
}

export default function PlayShelf() {
  const t = useT()
  const status = useStatus()
  return (
    <section aria-labelledby="play-shelf">
      <SectionHeader title={<span id="play-shelf">{t('play.title')}</span>} subtitle={t('play.subtitle')} />
      <Row label={t('play.title')} itemClassName="w-[74vw] max-w-[290px] sm:w-[290px]">
        {PLAY_TOOLS.map((tool) => <ToolCard key={tool.href} tool={tool} status={status[tool.href]} />)}
      </Row>
    </section>
  )
}
