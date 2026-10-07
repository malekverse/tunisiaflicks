"use client"
import React, { useState } from 'react'
import { Download, Sprout } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/src/components/ui/dialog'
import { toast } from '@/src/hooks/use-toast'
import { getDownloads, type DownloadQuery } from '@/src/app/actions/downloads'
import type { DownloadOption } from '@/src/lib/downloads'
import { useT } from '@/src/components/I18nProvider'

type Props = {
  title: string
  disabled?: boolean
  /** Shown as a toast when the button is clicked while disabled (e.g. no episode picked yet). */
  disabledHint?: string
} & DownloadQuery

/**
 * "Download" button that opens a dialog of real download sources (torrent magnets) for the title,
 * fetched on open from public indexes (YTS for movies, EZTV for episodes). Magnets open in the
 * viewer's own torrent app.
 */
export default function DownloadDialog({ title, disabled, disabledHint, ...query }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<DownloadOption[] | null>(null)

  const onOpenChange = (next: boolean) => {
    if (next && disabled) {
      toast({ title: t('common.notReady'), description: disabledHint ?? '', variant: 'destructive', duration: 3000 })
      return
    }
    setOpen(next)
    if (next && options === null && !loading) {
      setLoading(true)
      getDownloads(query)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setLoading(false))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-disabled={disabled}
          className={cn('pressable inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/[0.1] px-3.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-red-500', disabled && 'opacity-50')}
        >
          <Download aria-hidden className="h-4 w-4" /> {t('download.button')}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate pe-10 font-display text-2xl font-bold" dir="auto">{title}</DialogTitle>
          <DialogDescription>
            {t('download.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-red-500" />
            </div>
          ) : options && options.length > 0 ? (
            <ul className="space-y-2">
              {options.map((option, index) => (
                <li key={`${option.magnet.slice(0, 60)}-${index}`}>
                  <a
                    href={option.magnet}
                    onClick={() => toast({ title: t('download.opening'), description: option.label, duration: 3000 })}
                    className="pressable flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3.5 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.09]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-400"><Download aria-hidden className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" dir="auto">{option.label}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-white/50">
                        <span>{option.source}</span>
                        {option.size && <span>{option.size}</span>}
                        {typeof option.seeds === 'number' && (
                          <span className="inline-flex items-center gap-1"><Sprout aria-hidden className="h-3.5 w-3.5 text-emerald-400" />{option.seeds}</span>
                        )}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-white/55">
              {t('download.none')}
            </p>
          )}
        </div>

        <p className="text-xs text-white/40">
          {t('download.disclaimer')}
        </p>
      </DialogContent>
    </Dialog>
  )
}
