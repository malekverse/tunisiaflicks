"use client"
// Who sees something (a section of your page, a list): Only me / Friends / Anyone with the link,
// as a segmented control whose white pill slides to the choice. Radio semantics: arrows move.
import { useId, useRef } from 'react'
import { m } from 'framer-motion'
import { Link2, Lock, UsersRound, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import type { TKey } from '@/src/lib/i18n'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { Visibility } from '@/src/lib/social/types'

const ICONS: Record<Visibility, LucideIcon> = { private: Lock, friends: UsersRound, link: Link2 }

export default function VisibilitySelect({ value, onChange, label, context, options = ['private', 'friends', 'link'], solo = true, disabled }: {
  value: Visibility
  onChange: (v: Visibility) => void
  label: string
  context: 'profile' | 'list'
  options?: Visibility[]
  /** A list only its owner is in ('Only me'); a shared list says 'Only people in this list'. */
  solo?: boolean
  disabled?: boolean
}): JSX.Element {
  const { t, dir } = useI18n()
  const id = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const name = (option: Visibility): TKey => {
    if (option === 'private') return context === 'list' && !solo ? 'social.visibility.privateList' : 'social.visibility.private'
    return option === 'friends' ? 'social.visibility.friends' : 'social.visibility.link'
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = options.indexOf(value)
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    let next = -1
    if (event.key === forward || event.key === 'ArrowDown') next = (index + 1) % options.length
    else if (event.key === backward || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    if (next < 0 || disabled) return
    event.preventDefault()
    onChange(options[next])
    buttons.current[next]?.focus()
  }

  // When the row is too narrow, only the longest label wraps (to two lines); the short ones keep
  // their one line, whatever the language.
  const labels = options.map((option) => t(name(option)))
  const longest = labels.reduce((best, label, index) => (label.length > labels[best].length ? index : best), 0)

  const hintId = `${id}-hint`
  const showHint = context === 'profile' && value === 'link'
  return (
    <div className="w-full">
      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={showHint ? hintId : undefined}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={cn('flex w-full rounded-[24px] bg-white/[0.07] p-1', disabled && 'opacity-50')}
      >
        {options.map((option, index) => {
          const active = option === value
          const Icon = ICONS[option]
          return (
            <button
              key={option}
              ref={(node) => { buttons.current[index] = node }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => { if (!active) onChange(option) }}
              className={cn(
                // Each segment grows from its own label's width, so the long one ('Anyone with the
                // link') gets the room it needs.
                'relative flex min-h-11 select-none items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[13.5px] font-medium leading-tight outline-none transition-colors duration-200 [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] focus-visible:ring-2 focus-visible:ring-red-500',
                index === longest ? 'min-w-0 flex-auto' : 'flex-[1_0_auto] whitespace-nowrap',
                active ? 'text-black' : 'text-white/70 hover:text-white',
              )}
            >
              {active && <m.span layoutId={`visibility-pill-${id}`} transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
              <Icon aria-hidden className="relative h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="relative text-balance text-center">{labels[index]}</span>
            </button>
          )
        })}
      </div>
      {showHint && <p id={hintId} className="mt-2 text-[13px] leading-snug text-white/55">{t('social.visibility.linkHint')}</p>}
    </div>
  )
}
