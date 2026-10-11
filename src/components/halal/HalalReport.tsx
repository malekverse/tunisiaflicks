"use client"
import { useState } from 'react'
import { Check, Flag, Moon } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { cn } from '@/src/lib/utils'

/**
 * Under the player of a title Halal mode shows: "Not halal? Report it". One report hides the title
 * for everyone in Halal mode (see lib/halal); the filter can't be perfect, the viewers finish it.
 */
export default function HalalReport({ kind, id, className }: { kind: 'movie' | 'tv', id: string, className?: string }) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  const report = async () => {
    setState('sending')
    try {
      const response = await fetch('/api/halal/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id: Number(id) }),
      })
      if (!response.ok) throw new Error(String(response.status))
      setState('done')
      toast({ title: t('halal.report.done'), duration: 4000 })
    } catch {
      setState('idle')
      toast({ title: t('common.error'), variant: 'destructive', duration: 3000 })
    }
  }

  return (
    <div className={cn('page-x', className)}>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-emerald-500/[0.07] px-4 py-3 ring-1 ring-inset ring-emerald-400/15">
        <Moon aria-hidden className="h-4 w-4 shrink-0 text-emerald-300" />
        <p className="min-w-0 flex-1 text-[13px] text-white/70">{state === 'done' ? t('halal.report.done') : t('halal.report.text')}</p>
        {state !== 'done' ? (
          <button
            type="button"
            onClick={report}
            disabled={state === 'sending'}
            className="pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
          >
            <Flag aria-hidden className="h-3.5 w-3.5" />{t('halal.report.button')}
          </button>
        ) : (
          <Check aria-hidden className="h-4 w-4 text-emerald-300" />
        )}
      </div>
    </div>
  )
}
