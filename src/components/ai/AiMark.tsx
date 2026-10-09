"use client"
import { m, useReducedMotion } from 'framer-motion'
import { Sparkle } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'

/**
 * The mark of everything an AI produced on the site: lucide's Sparkle (the single four-point star;
 * Sparkles keeps meaning "new" elsewhere), white on a small glass tile. Never red, never a rainbow.
 * `thinking`: the star breathes while the answer is on its way (still under reduced motion).
 * Decorative: say "Ask" or "Thinking…" in text next to it.
 */
export function AiMark({ size = 36, thinking = false, className }: { size?: number, thinking?: boolean, className?: string }) {
  const reduce = useReducedMotion()
  const glyph = Math.round(size * 0.5)
  const star = <Sparkle aria-hidden className="fill-white text-white" strokeWidth={1.4} style={{ width: glyph, height: glyph }} />
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden bg-gradient-to-b from-white/[0.17] to-white/[0.05] ring-1 ring-inset ring-white/[0.16] shadow-[0_6px_18px_-8px_rgb(0_0_0/0.8)]',
        className,
      )}
      // A tile at list sizes; a disc when it sits inside a pill (the home chip).
      style={{ width: size, height: size, borderRadius: size <= 28 ? size / 2 : Math.round(size * 0.3) }}
    >
      {/* Light catching the top edge of the glass. */}
      <span className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      {thinking && !reduce ? (
        <m.span
          className="grid place-items-center"
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: [1, 0.4, 1], scale: [1, 0.84, 1] }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
        >
          {star}
        </m.span>
      ) : star}
    </span>
  )
}

/** The line under every AI answer: where it comes from, and that it can be wrong. */
export function AiNote({ className }: { className?: string } = {}) {
  const t = useT()
  return (
    <p className={cn('flex items-start gap-2 text-[13px] leading-snug text-white/50', className)}>
      <Sparkle aria-hidden className="mt-[2px] h-3.5 w-3.5 shrink-0 fill-current" strokeWidth={1.4} />
      <span>{t('ai.note')}</span>
    </p>
  )
}

export default AiMark
