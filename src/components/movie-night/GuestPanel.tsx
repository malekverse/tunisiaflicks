"use client"
// Who's coming: the faces of everyone going, then everyone by name with where they stand. The
// host also sees the people asking to join (Approve / Decline, right there) and how the link is
// doing. Requests never show to the other guests.
import { useState } from 'react'
import Link from 'next/link'
import { Link2, Link2Off } from 'lucide-react'
import { AvatarStack, UserAvatar } from '@/src/components/social/Avatar'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import type { NightView } from '@/src/lib/movie-night'
import type { GuestStatus } from '@/src/lib/movie-night-rules'
import { cn } from '@/src/lib/utils'
import type { Act } from './NightView'

const ORDER: Record<GuestStatus, number> = { going: 0, invited: 1, cant: 2, requested: 3 }

export default function GuestPanel({ view, act, className }: { view: NightView; act: Act; className?: string }) {
  const t = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const isHost = view.role === 'host'
  const requests = view.guests.filter((guest) => guest.status === 'requested')
  const others = view.guests.filter((guest) => guest.status !== 'requested').sort((a, b) => ORDER[a.status] - ORDER[b.status])
  const going = [view.host, ...view.guests.filter((guest) => guest.status === 'going')]
  const invited = view.guests.filter((guest) => guest.status === 'invited').length

  const answer = async (profileId: string, approve: boolean) => {
    setBusy(profileId)
    await act('approve', { profileId, approve })
    setBusy(null)
  }

  return (
    <section aria-labelledby="night-guests" className={cn('rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="night-guests" className="font-display text-[21px] font-bold leading-tight">{t('movieNight.page.guests')}</h2>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-white/60">
            <span>{t('movieNight.page.goingCount', { count: view.goingCount })}</span>
            {invited > 0 && <span>{t('movieNight.page.invitedCount', { count: invited })}</span>}
          </p>
        </div>
        <AvatarStack people={going} total={going.length} size={32} className="shrink-0 pt-1" />
      </div>

      {isHost && requests.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-inset ring-white/[0.06]">
          <h3 className="px-1 text-[13px] font-medium text-white/70">{t('movieNight.page.requests')}</h3>
          <ul className="mt-2 space-y-2">
            {requests.map((guest) => (
              <li key={guest.profileId} className="flex flex-wrap items-center gap-3 px-1 py-1">
                <UserAvatar person={guest} size={32} />
                <bdi className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{guest.name}</bdi>
                <span className="flex gap-2">
                  <Button size="sm" className="h-11 px-4 text-[14px] sm:h-9" disabled={busy === guest.profileId} onClick={() => answer(guest.profileId, true)}>{t('movieNight.approve')}</Button>
                  <Button size="sm" variant="ghost" className="h-11 px-4 text-[14px] ring-1 ring-inset ring-white/[0.12] sm:h-9" disabled={busy === guest.profileId} onClick={() => answer(guest.profileId, false)}>{t('movieNight.decline')}</Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-0.5">
        {[{ ...view.host, status: 'host' as const }, ...others].map((person) => {
          const content = (
            <>
              <UserAvatar person={person} size={32} />
              <bdi className="min-w-0 flex-1 truncate text-[14.5px] text-white">{person.name}</bdi>
              <span className={cn('shrink-0 text-[13px]', person.status === 'going' || person.status === 'host' ? 'text-white/75' : 'text-white/55')}>
                {t(`movieNight.status.${person.status}`)}
              </span>
            </>
          )
          const row = 'flex min-h-[44px] items-center gap-3 rounded-xl px-1.5 py-1'
          return (
            <li key={person.profileId}>
              {person.handle
                ? <Link href={`/u/${person.handle}`} className={cn(row, 'outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-red-500')}>{content}</Link>
                : <div className={row}>{content}</div>}
            </li>
          )
        })}
      </ul>
      {others.length === 0 && isHost && <p className="mt-2 text-[13px] leading-relaxed text-white/55">{t('movieNight.page.noGuests')}</p>}

      {isHost && view.link && (
        <p className="mt-4 flex items-center gap-2 border-t border-white/[0.07] pt-4 text-[13px] text-white/60">
          {view.link.active || view.link.uses > 0 ? <Link2 aria-hidden className="h-4 w-4" /> : <Link2Off aria-hidden className="h-4 w-4" />}
          <span>{t('movieNight.page.link')}</span>
          <span className="ms-auto tabular-nums">
            {view.link.maxUses > 0 ? t('movieNight.page.linkUses', { uses: view.link.uses, maxUses: view.link.maxUses }) : t('movieNight.page.linkOff')}
          </span>
        </p>
      )}
    </section>
  )
}
