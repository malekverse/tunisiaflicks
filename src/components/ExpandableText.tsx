"use client"
import React, { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { useT } from './I18nProvider'

// The last clamped line fades out instead of stopping dead (a mask, so it works on any background).
const FADE: React.CSSProperties = {
  WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 1.75em), transparent)',
  maskImage: 'linear-gradient(to bottom, #000 calc(100% - 1.75em), transparent)',
}

/** Long text clamped to a few lines with a "Read more / Show less" toggle (only when it's long). */
export default function ExpandableText({ text, lines = 5, threshold = 420 }: { text: string, lines?: number, threshold?: number }) {
  const [expanded, setExpanded] = useState(false)
  const t = useT()
  const id = useId()
  const isLong = text.length > threshold
  const clamped = !expanded && isLong

  return (
    <div>
      <p
        id={id}
        className="whitespace-pre-line text-pretty text-[15px] leading-[1.75] text-white/70"
        style={clamped ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden', ...FADE } : undefined}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={id}
          className="pressable -ms-1 mt-2 inline-flex items-center gap-1 rounded-full py-1.5 pe-2 ps-1 text-[14px] font-medium text-white outline-none hover:text-white/80 focus-visible:ring-2 focus-visible:ring-red-500"
        >
          {expanded ? t('common.showLess') : t('common.readMore')}
          <ChevronDown aria-hidden className={cn('h-4 w-4 transition-transform duration-200 ease-out', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}
