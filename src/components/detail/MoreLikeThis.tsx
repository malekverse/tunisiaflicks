"use client"
// "More like this, but…": the recommendations, and chips that swap them for a variation (lighter,
// darker, shorter, older, newer, as a series or a film, from the Arab world). The chips are tabs
// with manual activation: arrows move between them, Enter or Space shows one. Each variation loads
// on demand (and in advance when a chip is hovered or focused with a mouse).
import { useState } from 'react'
import { m } from 'framer-motion'
import { RotateCw, SearchX } from 'lucide-react'
import PosterCard, { SkeletonLoader as PosterSkeleton } from '@/src/components/PosterCard'
import { Row, ROW_WIDTH } from '@/src/components/rows/Row'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { prefetchVariation, useVariation } from '@/src/hooks/use-variation'
import { cardProps } from '@/src/lib/card-props'
import { tween } from '@/src/lib/motion'
import type { TKey } from '@/src/lib/i18n'
import { variationChip, variationTitle, type Kind, type Phrase, type Variation, type VariationTab } from '@/src/lib/variations'

export type SimilarTab = { id: VariationTab, hint: Phrase | null }

const PANEL = 'similar-panel'

/** A short note in the row's place (nothing close enough, or a failed load), with its way out. */
function Note({ icon, title, text, action }: { icon: React.ReactNode, title: string, text: string, action?: React.ReactNode }) {
  return (
    <div className="page-x">
      <div className="flex min-h-[220px] flex-col items-start justify-center gap-1 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:min-h-[260px] sm:p-6">
        <span aria-hidden className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-white/60">{icon}</span>
        <p className="font-display text-[19px] font-bold text-white">{title}</p>
        <p className="max-w-[52ch] text-[14px] text-white/60">{text}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

export default function MoreLikeThis({ kind, id, kids, closest, tabs }: {
  kind: Kind
  id: string
  /** The profile the page was rendered for (the API checks it still is). */
  kids: boolean
  /** The recommendations, from the page. */
  closest: any[]
  /** Closest (when it has titles) then the variations, in display order, with their hint lines. */
  tabs: SimilarTab[]
}) {
  const { t, locale } = useI18n()
  const [active, setActive] = useState<VariationTab>(tabs[0]?.id ?? 'closest')
  // The first row is there from the start (no fade, and visible without JavaScript); a switch fades.
  const [switched, setSwitched] = useState(false)
  const show = (tab: VariationTab) => {
    setSwitched(true)
    setActive(tab)
  }
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]
  const variation: Variation | null = current && current.id !== 'closest' ? current.id : null
  const result = useVariation({ type: kind, id, but: variation, kids, locale })
  if (!current) return null

  const hasClosest = tabs.some((tab) => tab.id === 'closest')
  const title = t(variationTitle(current.id, kind) as TKey)
  const hint = current.hint ? t(current.hint.key as TKey, current.hint.vars) : current.id === 'closest' ? t('more.hint.closest' as TKey) : null

  const prefetch = (target: EventTarget | null) => {
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) return
    const tab = (target as HTMLElement | null)?.closest?.('[data-chip]')?.querySelector<HTMLElement>('[data-variation]')?.dataset.variation
    if (tab && tab !== 'closest') prefetchVariation({ type: kind, id, but: tab as Variation, kids, locale })
  }

  const items = variation ? result.items : closest
  let body: React.ReactNode
  if (variation && result.status === 'error') {
    body = (
      <Note
        icon={<RotateCw className="h-5 w-5" />}
        title={t('more.error' as TKey)}
        text={t('more.errorText' as TKey)}
        action={<Button variant="secondary" onClick={result.retry}><RotateCw aria-hidden className="h-4 w-4" />{t('more.retry' as TKey)}</Button>}
      />
    )
  } else if (variation && result.status !== 'ready') {
    // Skeletons only when it takes a while (a quick answer never flashes them).
    body = (
      <div aria-hidden className="min-h-[220px] sm:min-h-[260px]">
        {result.slow && (
          <Row itemClassName={ROW_WIDTH.poster}>
            {Array.from({ length: 8 }).map((_, index) => <PosterSkeleton key={index} />)}
          </Row>
        )}
      </div>
    )
  } else if (items.length === 0) {
    body = (
      <Note
        icon={<SearchX className="h-5 w-5" />}
        title={t('more.empty' as TKey)}
        text={t('more.emptyText' as TKey)}
        action={hasClosest ? <Button variant="secondary" onClick={() => show('closest')}>{t('more.showClosest' as TKey)}</Button> : undefined}
      />
    )
  } else {
    body = (
      <Row itemClassName={ROW_WIDTH.poster}>
        {items.map((item: any) => {
          const itemKind: Kind = variation ? (item.media_type === 'tv' ? 'tv' : 'movie') : kind
          return <PosterCard key={`${itemKind}-${item.id}`} {...cardProps(item, itemKind)} showTypeBadge={current.id === 'kind'} />
        })}
      </Row>
    )
  }

  return (
    <section id="similar" aria-labelledby="similar-title" className="scroll-mt-[calc(var(--topbar)+72px)]">
      <div className="page-x mb-3 sm:mb-4">
        <h2 id="similar-title" className="font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">{title}</h2>
        {/* The line keeps its height when a tab has none, so the row below doesn't jump. */}
        <p className="mt-0.5 min-h-[1.25rem] text-[13px] text-white/55">{hint}</p>
      </div>
      {tabs.length > 1 && (
        <div className="page-x mb-4" onPointerOver={(event) => prefetch(event.target)} onFocus={(event) => prefetch(event.target)}>
          <ChipGroup label={t('more.chips' as TKey)} mode="tabs" scroll>
            {tabs.map((tab) => (
              <Chip key={tab.id} active={tab.id === current.id} controls={PANEL} onClick={() => show(tab.id)}>
                <span data-variation={tab.id}>{t(variationChip(tab.id, kind) as TKey)}</span>
              </Chip>
            ))}
          </ChipGroup>
        </div>
      )}
      <div id={PANEL} role={tabs.length > 1 ? 'tabpanel' : undefined} aria-label={title} aria-busy={variation !== null && result.status === 'loading'}>
        <m.div key={current.id} initial={switched ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={tween.base}>
          {body}
        </m.div>
      </div>
    </section>
  )
}
