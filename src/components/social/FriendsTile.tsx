"use client"
// The menu sheet's Friends tile: a few friends' faces, and how many requests wait. A red dot only
// while a request is unread; otherwise a quiet count. Guests get the tile too (it leads to the
// signed-out Friends page).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, UsersRound } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { AvatarStack } from '@/src/components/social/Avatar'
import type { PublicIdentity } from '@/src/lib/social/types'

type Summary = { friends: PublicIdentity[]; total: number; pendingIncoming: number; unreadRequests: number }

export default function FriendsTile({ signedIn, onNavigate }: { signedIn: boolean; onNavigate: () => void }) {
  const t = useT()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    fetch('/api/social/friends?summary=1', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled && data) setSummary(data) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [signedIn])

  const waiting = summary?.pendingIncoming ?? 0
  const line = !signedIn
    ? t('social.together.signedOut')
    : !summary || summary.total === 0
      ? t('social.together.addFriend')
      : summary.total === 1 ? t('social.together.oneFriend') : t('social.together.friendsCount', { count: summary.total })

  return (
    <Link
      href={waiting > 0 ? '/friends/list#requests' : '/friends'}
      onClick={onNavigate}
      className="pressable relative flex h-[84px] flex-col justify-between overflow-hidden rounded-[22px] bg-white/[0.05] p-3.5 outline-none ring-1 ring-inset ring-white/[0.07] transition-colors active:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">{t('social.together.friends')}</span>
        {waiting > 0 && (
          <>
            <span className="sr-only">{t('social.together.requestsAria', { count: waiting })}</span>
            {summary!.unreadRequests > 0 ? (
              // Red only while something is unread (the signal light).
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgb(255_36_20)]" />
            ) : (
              <span aria-hidden className="grid h-6 min-w-6 place-items-center rounded-full bg-white/15 px-1.5 text-[11.5px] font-semibold tabular-nums text-white">
                {waiting > 9 ? '9+' : waiting}
              </span>
            )}
          </>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        {summary && summary.friends.length > 0
          ? <AvatarStack people={summary.friends} total={summary.total} size={24} />
          : signedIn
            ? <UserPlus aria-hidden className="h-[18px] w-[18px] shrink-0 text-white/70" />
            : <UsersRound aria-hidden className="h-[18px] w-[18px] shrink-0 text-white/70" />}
        {/* Two short lines at most: a half-width tile on a phone is about 170px wide. */}
        <span className="line-clamp-2 min-w-0 text-[12.5px] leading-tight text-white/60">{line}</span>
      </span>
    </Link>
  )
}
