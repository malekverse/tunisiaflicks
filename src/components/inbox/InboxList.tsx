"use client"
// The inbox's rows (the bell's popover and sheet, and /notifications), its loading rows and its
// empty state. The weekly-email hint shows only when the caller says the digest is on offer.
import Link from 'next/link'
import { Bell, ChevronRight, Mail } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Skeleton } from '@/src/components/ui/skeleton'
import type { NotificationItem } from '@/src/lib/models/Follow'
import { InboxItem } from './InboxItem'

function DigestHint() {
  const t = useT()
  return (
    <Link
      href="/profile#email"
      className="group pressable mt-1 flex items-center gap-3 rounded-2xl p-2.5 outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
    >
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07]"><Mail className="h-[18px] w-[18px] text-white/75" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-white">{t('social.inbox.digestHint')}</span>
        <span className="block text-[12.5px] text-white/55">{t('social.inbox.digestHintText')}</span>
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/40 rtl:rotate-180" />
    </Link>
  )
}

export function InboxList({ items, loading, digestHint, onChange }: { items: NotificationItem[]; loading?: boolean; digestHint?: boolean; onChange?: (i: NotificationItem) => void }): JSX.Element {
  const t = useT()

  if (loading && items.length === 0) {
    return (
      <div aria-busy className="space-y-1">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-3 p-2.5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3.5 w-4/5 rounded-full" />
              <Skeleton className="h-3 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div>
        <div className="flex flex-col items-center gap-2 px-6 pb-6 pt-5 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.06]">
            <Bell aria-hidden className="h-5 w-5 text-white/60" />
          </span>
          <p className="mt-1 text-[15px] font-semibold text-white">{t('social.inbox.empty')}</p>
          <p className="max-w-[28ch] text-[13px] leading-relaxed text-white/55">{t('social.inbox.emptyText')}</p>
        </div>
        {digestHint && <DigestHint />}
      </div>
    )
  }

  return (
    <div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id}><InboxItem item={item} onChange={onChange} /></li>
        ))}
      </ul>
      {digestHint && <DigestHint />}
    </div>
  )
}
