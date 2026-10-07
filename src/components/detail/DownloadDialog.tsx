"use client"
import React, { useState } from 'react'
import { FaDownload, FaSeedling } from 'react-icons/fa6'
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
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium bg-white text-red-600 hover:bg-red-50 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <FaDownload className="text-xs" /> {t('download.button')}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="truncate" dir="auto">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('download.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500" />
            </div>
          ) : options && options.length > 0 ? (
            <ul className="space-y-2">
              {options.map((option, index) => (
                <li key={`${option.magnet.slice(0, 60)}-${index}`}>
                  <a
                    href={option.magnet}
                    onClick={() => toast({ title: t('download.opening'), description: option.label, duration: 3000 })}
                    className="flex items-center gap-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors p-3"
                  >
                    <FaDownload className="text-red-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" dir="auto">{option.label}</p>
                      <p className="text-xs text-gray-400 flex flex-wrap gap-x-3">
                        <span>{option.source}</span>
                        {option.size && <span>{option.size}</span>}
                        {typeof option.seeds === 'number' && (
                          <span className="inline-flex items-center gap-1"><FaSeedling className="text-green-500" />{option.seeds}</span>
                        )}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-center py-10 text-sm">
              {t('download.none')}
            </p>
          )}
        </div>

        <p className="text-xs text-gray-500">
          {t('download.disclaimer')}
        </p>
      </DialogContent>
    </Dialog>
  )
}
