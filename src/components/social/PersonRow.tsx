"use client"
// A person in a list (friends, requests, blocked people, a handle you looked up): their face, name
// and @handle, leading to their page, with the row's actions beside the link (never inside it).
// Also the confirm dialog these lists share (Cancel is focused first: a slip of Enter undoes nothing).
import React, { useRef } from 'react'
import Link from 'next/link'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import type { AvatarPerson } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'
import { UserAvatar } from './Avatar'

export default function PersonRow({ person, href, line, children, className }: {
  person: AvatarPerson
  /** Their page (default /u/handle when they have one); null for a plain row. */
  href?: string | null
  /** A second line instead of the @handle. */
  line?: React.ReactNode
  /** The row's actions (buttons, a menu), on the end side. */
  children?: React.ReactNode
  className?: string
}) {
  const target = href === undefined ? (person.handle ? `/u/${person.handle}` : null) : href
  const body = (
    <>
      <UserAvatar person={person} size={40} />
      <span className="min-w-0 flex-1">
        {/* Block spans around inline bdi: the row's own direction aligns them (an Arabic name in an
            English list stays on the start side). */}
        <span className="block truncate text-[15px] font-medium text-white"><bdi>{person.name}</bdi></span>
        {line ?? (person.handle && <span className="block truncate text-[13px] text-white/55"><bdi dir="ltr">@{person.handle}</bdi></span>)}
      </span>
    </>
  )
  return (
    <div className={cn('flex min-h-[64px] items-center gap-3 px-3 py-2.5 sm:px-4', className)}>
      {target ? (
        <Link href={target} className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-red-500">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

/** "Remove Amine?" and friends: a small dialog, the safe choice focused first. */
export function ConfirmDialog({ open, onOpenChange, title, text, confirm, onConfirm, busy, tone = 'destructive' }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  text: React.ReactNode
  confirm: string
  onConfirm: () => void
  busy?: boolean
  tone?: 'destructive' | 'default'
}) {
  const t = useT()
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
      <DialogContent
        className="max-w-sm"
        onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus() }}
      >
        <DialogHeader className="pe-8">
          <DialogTitle className="text-balance font-display text-[24px] font-bold leading-tight">{title}</DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed">{text}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2">
          <Button ref={cancel} variant="ghost" className="h-11" onClick={() => onOpenChange(false)} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant={tone === 'destructive' ? 'destructive' : 'default'} className="h-11" onClick={onConfirm} disabled={busy}>{confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
