"use client"
import React, { useId } from 'react'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { Label } from '@/src/components/ui/label'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'

export const LIST_TITLE_MAX = 80
export const LIST_DESCRIPTION_MAX = 300

/** Title + description fields for a list (create and edit), labels above, a counter near the limit. */
export default function ListDetailsFields({ title, description, onTitle, onDescription, autoFocus }: {
  title: string
  description: string
  onTitle: (value: string) => void
  onDescription: (value: string) => void
  autoFocus?: boolean
}) {
  const t = useT()
  const id = useId()
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`${id}-title`} className="text-[13px] font-medium text-white/70">{t('library.listTitle')}</Label>
          <Counter value={title.length} max={LIST_TITLE_MAX} />
        </div>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          maxLength={LIST_TITLE_MAX}
          placeholder={t('library.listTitlePlaceholder')}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="done"
          className="text-base sm:text-[15px]"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`${id}-description`} className="text-[13px] font-medium text-white/70">{t('library.listDescription')}</Label>
          <Counter value={description.length} max={LIST_DESCRIPTION_MAX} />
        </div>
        <Textarea
          id={`${id}-description`}
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          maxLength={LIST_DESCRIPTION_MAX}
          rows={3}
          placeholder={t('library.listDescriptionPlaceholder')}
          className="min-h-[88px] resize-none text-base sm:text-[15px]"
        />
      </div>
    </div>
  )
}

/** Only shows up once the text gets close to the limit. */
function Counter({ value, max }: { value: number, max: number }) {
  const near = value >= max * 0.8
  return (
    <span aria-hidden className={cn('text-[12px] tabular-nums transition-opacity duration-200', near ? 'opacity-100' : 'opacity-0', value >= max ? 'text-red-400' : 'text-white/45')}>
      {value}/{max}
    </span>
  )
}
