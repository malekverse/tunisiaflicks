"use client"
import { useId } from 'react'
import { m } from 'framer-motion'
import { Search, Sparkle } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

export type SearchMode = 'titles' | 'ask'

/** Titles | Ask: how the search field reads what's typed. The white pill slides to the choice. */
export function ModeSwitch({ mode, onChange, className }: { mode: SearchMode, onChange: (mode: SearchMode) => void, className?: string }) {
  const t = useT()
  const pill = useId()
  return (
    <div role="group" aria-label={t('ai.mode')} className={cn('flex w-fit shrink-0 rounded-full bg-white/[0.07] p-1', className)}>
      {(['titles', 'ask'] as const).map((value) => {
        const on = mode === value
        const Icon = value === 'ask' ? Sparkle : Search
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(value)}
            className={cn(
              'pressable relative inline-flex h-11 select-none items-center rounded-full px-4 text-[14px] font-medium outline-none transition-colors duration-200 [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-red-500',
              on ? 'text-black' : 'text-white/70 hover:text-white',
            )}
          >
            {on && <m.span layoutId={`search-mode-${pill}`} transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
            <span className="relative inline-flex items-center gap-2">
              <Icon aria-hidden className={cn('h-4 w-4', value === 'ask' && 'fill-current')} strokeWidth={value === 'ask' ? 1.4 : 2} />
              {t(value === 'ask' ? 'ai.ask' : 'ai.titles')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
