"use client"
import { useMemo, useRef } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { CircleSlash, Hourglass, Info, Loader2, RotateCcw, Search, SearchX, Timer, WifiOff } from 'lucide-react'
import MediaGrid, { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import { Button } from '@/src/components/ui/button'
import { AiMark, AiNote } from '@/src/components/ai/AiMark'
import { useI18n } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import { quote } from '@/src/lib/i18n/format'
import { richT } from '@/src/lib/i18n/rich'
import type { TKey } from '@/src/lib/i18n'
import { dailyPrompts } from '@/src/lib/ai-search/prompts'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { AskChip } from '@/src/lib/ai-search/types'
import type { AskState } from './use-ai-search'

const STAGGER = 0.04
const STAGGER_CAP = 8

/**
 * The Ask answer, in reading order: what Ask understood (removable chips led by the AI mark), the
 * titles, the AI note, Show more. Plus its other states: the empty page with examples, thinking,
 * nothing found, limits reached, the catalogue or Ask unavailable. One polite status line tells
 * screen readers what happened.
 */
export function AskPanel({ state, onTry, onRemove, onMore, onRetry, onSearchTitles, focusField }: {
  state: AskState
  onTry: (question: string) => void
  onRemove: (chip: AskChip) => void
  onMore: () => void
  onRetry: () => void
  onSearchTitles: () => void
  /** Where focus goes when the last chip is removed with the keyboard. */
  focusField: () => void
}) {
  const { t, locale } = useI18n()
  const list = useRef<HTMLDivElement>(null)
  const prompts = useMemo(() => dailyPrompts(3), [])
  const { phase, reading, chips, items, notices, ai, error } = state
  const loading = phase === 'loading'
  const answered = chips.length > 0

  // Backspace or Delete on a chip's X removes it; focus moves to the next chip, else the field.
  const removeWithKeyboard = (chip: AskChip, index: number) => {
    onRemove(chip)
    requestAnimationFrame(() => {
      const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[data-chip-id] button') ?? [])
        .filter((button) => button.closest('[data-chip-id]')?.getAttribute('data-chip-id') !== chip.id)
      const next = buttons[Math.min(index, buttons.length - 1)]
      if (next) next.focus()
      else focusField()
    })
  }

  const status = reading ? t('ai.thinking')
    : phase === 'ready' ? (items.length ? t('ai.status.ready') : t('ai.empty.none'))
      : phase === 'error' ? errorText(error?.code, !!error?.signIn) : ''

  function errorText(code: string | undefined, signIn: boolean) {
    switch (code) {
      case 'rate_minute': return t('ai.error.rateMinute')
      case 'rate_day': return signIn ? t('ai.error.rateDayGuest') : t('ai.error.rateDay')
      case 'busy': return t('ai.error.busy')
      case 'tmdb': return t('ai.error.tmdb')
      default: return t('ai.error.failed')
    }
  }

  // Nothing asked yet: three examples of the day, and what Ask does with your words.
  if (phase === 'idle') {
    return (
      <section className="page-x">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3.5">
            <AiMark size={44} />
            <h2 className="font-display text-[22px] font-bold leading-tight text-white sm:text-[26px]">{t('ai.empty.title')}</h2>
          </div>
          <ChipGroup label={t('ai.try.title')} mode="none" className="mt-5">
            {prompts.map((key) => (
              <Chip key={key} onClick={() => onTry(t(key as TKey))} className="max-w-full">
                <bdi className="block truncate">{t(key as TKey)}</bdi>
              </Chip>
            ))}
          </ChipGroup>
          <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-white/50">{t('ai.privacy')}</p>
        </div>
      </section>
    )
  }

  const errorIcon = error?.code === 'rate_minute' ? Timer : error?.code === 'rate_day' ? Hourglass : error?.code === 'busy' ? Hourglass : error?.code === 'tmdb' ? WifiOff : CircleSlash
  const ErrorIcon = errorIcon
  const removable = chips.find((chip) => chip.id === state.tryWithout)

  return (
    <section aria-label={t('ai.ask')} className="page-x">
      <p role="status" aria-live="polite" className="sr-only">{status}</p>

      {/* What Ask understood. */}
      {(answered || reading) && (
        <div className="flex items-start gap-3">
          {(ai || !answered) && <AiMark size={40} thinking={loading} />}
          {!answered && <span className="self-center text-[15px] text-white/60">{t('ai.thinking')}</span>}
          {answered && (
            <div ref={list} role="list" aria-label={t('ai.chip.label')} className="flex min-w-0 flex-1 flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {chips.map((chip, index) => (
                  <m.span
                    key={chip.id}
                    role="listitem"
                    layout
                    className="inline-flex max-w-full"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                    transition={{ default: { ...spring.ui, delay: Math.min(index, STAGGER_CAP) * STAGGER }, layout: spring.ui }}
                    onKeyDown={(event) => {
                      const target = event.target as HTMLElement
                      if ((event.key === 'Backspace' || event.key === 'Delete') && target.tagName === 'BUTTON' && target.closest('[data-chip-id]')?.getAttribute('data-chip-id') === chip.id) {
                        event.preventDefault()
                        removeWithKeyboard(chip, index)
                      }
                    }}
                  >
                    <RemovableChip chip={chip} label={t('ai.chip.remove', { label: chip.label })} onRemove={() => onRemove(chip)} />
                  </m.span>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {notices.length > 0 && answered && (
        <ul className="mt-3 space-y-1.5">
          {notices.map((notice) => (
            <li key={notice.code} className="flex items-start gap-2 text-[13px] leading-snug text-white/60">
              <Info aria-hidden className="mt-[2px] h-3.5 w-3.5 shrink-0 text-white/50" />
              <span>
                {notice.code === 'resting' ? t('ai.notice.resting')
                  : notice.code === 'unmatched' ? richT(t, 'ai.notice.unmatched', { words: notice.words.map((word) => quote(word, locale)).join(', ') })
                    : richT(t, 'ai.notice.likeNotFound', { title: quote(notice.title, locale) })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={cn(answered || reading ? 'mt-8' : '')}>
        {phase === 'error' ? (
          <EmptyState
            title={t('ai.error.title')}
            icon={<ErrorIcon aria-hidden className="h-6 w-6" />}
            action={(
              <>
                {error?.signIn && (
                  <Button asChild>
                    <Link href={withCallback('/login', typeof window === 'undefined' ? '/search' : window.location.pathname + window.location.search)}>{t('nav.signIn')}</Link>
                  </Button>
                )}
                {error?.code !== 'rate_day' && (
                  <Button variant="secondary" onClick={onRetry}><RotateCcw aria-hidden className="h-4 w-4" />{t('ai.error.retry')}</Button>
                )}
                <Button variant="ghost" onClick={onSearchTitles}><Search aria-hidden className="h-4 w-4" />{t('ai.error.searchTitles')}</Button>
              </>
            )}
          >
            {errorText(error?.code, !!error?.signIn)}
          </EmptyState>
        ) : items.length > 0 ? (
          <div className={cn('transition-opacity duration-300', loading && 'opacity-60')}>
            <MediaGrid items={items} showTypeBadge={!chips.some((chip) => chip.id === 'k')} />
          </div>
        ) : phase === 'ready' ? (
          <EmptyState
            title={t('ai.empty.none')}
            icon={<SearchX aria-hidden className="h-6 w-6" />}
            action={removable ? (
              <Button variant="secondary" onClick={() => onRemove(removable)}>{richT(t, 'ai.empty.tryWithout', { label: removable.label })}</Button>
            ) : undefined}
          >
            {t('ai.empty.noneText')}
          </EmptyState>
        ) : reading ? (
          <div className={GRID_CLASS}>
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="tf-shimmer relative aspect-[2/3] rounded-poster" />)}
          </div>
        ) : null}
      </div>

      {phase === 'ready' && items.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-6">
          {ai && <AiNote className="justify-center text-center" />}
          {state.hasMore && (
            <Button variant="secondary" size="lg" onClick={onMore} disabled={state.more} aria-busy={state.more}>
              {state.more && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
              {t('ai.showMore')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

/** A chip of the answer with its own X beside it (the X is the focusable part). */
function RemovableChip({ chip, label, onRemove }: { chip: AskChip, label: string, onRemove: () => void }) {
  return (
    <span className="contents" data-chip-id={chip.id}>
      <Chip onRemove={onRemove} removeLabel={label} className="max-w-full">
        <bdi className="block max-w-[16rem] truncate" title={chip.label}>{chip.label}</bdi>
      </Chip>
    </span>
  )
}
