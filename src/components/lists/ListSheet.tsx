"use client"
// The lists' panels: a dialog from `from` up (sm: 640px, md: 768px), a bottom sheet on phones.
// And the confirmation every irreversible people action goes through, with Cancel focused first.
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/src/components/ui/drawer'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'

const QUERIES = { sm: '(min-width: 640px)', md: '(min-width: 768px)' } as const

/** Whether the screen is at least `from` wide (read in the browser; these panels only open there). */
export function useWideScreen(from: keyof typeof QUERIES = 'sm') {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERIES[from]).matches)
  useEffect(() => {
    const query = window.matchMedia(QUERIES[from])
    const onChange = () => setWide(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [from])
  return wide
}

export function ListSheet({ open, onOpenChange, title, description, children, from = 'sm', className, titleHidden }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  from?: keyof typeof QUERIES
  className?: string
  /** The title is for screen readers only (the content shows its own heading). */
  titleHidden?: boolean
}) {
  const wide = useWideScreen(from)
  const content = useRef<HTMLDivElement>(null)
  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={content}
          // The panel itself takes focus: Tab goes on from its first control, nothing looks chosen.
          onOpenAutoFocus={(event) => { event.preventDefault(); content.current?.focus() }}
          className={cn('max-h-[calc(100dvh-48px)] max-w-[480px] overflow-y-auto overscroll-contain p-6 outline-none', className)}
        >
          <DialogTitle className={titleHidden ? 'sr-only' : 'pe-10 font-display text-[22px] font-bold leading-tight'}>{title}</DialogTitle>
          <DialogDescription className={description ? '-mt-2 text-[14px] text-white/60' : 'sr-only'}>{description ?? title}</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="no-scrollbar overflow-y-auto overscroll-contain px-5 pb-6 pt-4">
          <DrawerTitle className={titleHidden ? 'sr-only' : 'font-display text-[22px] font-bold leading-tight'}>{title}</DrawerTitle>
          <DrawerDescription className={description ? 'mt-1 text-[14px] text-white/60' : 'sr-only'}>{description ?? title}</DrawerDescription>
          <div className={cn(!titleHidden && 'mt-5', className)}>{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/** "Remove Sami?": Cancel is focused first, so Enter never does the irreversible thing by accident. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, busy, icon }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
  icon?: React.ReactNode
}) {
  const t = useT()
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-sm" onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus() }}>
        <DialogHeader>
          {icon && <span aria-hidden className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-red-600/15 text-red-400 max-sm:mx-auto">{icon}</span>}
          <DialogTitle className="text-balance font-display text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button ref={cancel} type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)} className="h-11">{t('common.cancel')}</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm} className="h-11">{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
