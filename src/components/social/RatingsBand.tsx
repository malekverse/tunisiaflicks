"use client"
// The detail page's ratings: yours, your friends' (as far as they share), and the TunisiaFlicks
// average once enough verified accounts have rated. Guests see the average and a way to sign in,
// or nothing at all when there is no average yet.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AnimatePresence, m } from 'framer-motion'
import { Info } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useProfiles } from '@/src/hooks/use-profiles'
import { toast } from '@/src/hooks/use-toast'
import { tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { PublicIdentity, ShareMedia } from '@/src/lib/social/types'
import { AvatarStack, UserAvatar } from './Avatar'
import { RatingStars, RatingSummary, StarsReadOnly } from './RatingStars'

type Ratings = { mine: number | null; friends: { person: PublicIdentity; stars: number }[]; average: number | null; countLabel: string | null }

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6', className)}>
      <p className="w-44 shrink-0 text-[13px] font-medium text-white/70">{label}</p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default function RatingsBand({ id, media }: { id?: string; media: ShareMedia }): JSX.Element | null {
  const t = useT()
  const pathname = usePathname()
  const { status } = useSession()
  const { active } = useProfiles()
  const [data, setData] = useState<Ratings | null>(null)
  const [mine, setMine] = useState<number | null>(null)
  const [hint, setHint] = useState(false)
  const [failed, setFailed] = useState(false)
  const saving = useRef(0)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/ratings?type=${media.media_type}&id=${media.id}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const body: Ratings = await response.json()
      setData(body)
      setMine(body.mine)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [media.media_type, media.id])

  useEffect(() => {
    if (status === 'loading') return
    load()
  }, [status, load, active?.id])

  const change = async (next: number | null) => {
    const previous = mine
    const attempt = ++saving.current
    setMine(next)
    try {
      const response = next === null
        ? await fetch(`/api/ratings?type=${media.media_type}&id=${media.id}`, { method: 'DELETE' })
        : await fetch('/api/ratings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: media.media_type, id: media.id, rating: next }),
        })
      if (!response.ok) throw new Error(String(response.status))
      const body = await response.json().catch(() => ({}))
      if (body.first && body.hint === 'private') setHint(true)
    } catch {
      if (attempt === saving.current) setMine(previous)
      toast({ variant: 'destructive', title: t('social.ratings.saveFailed') })
    }
  }

  const signedIn = status === 'authenticated'
  const grownUp = !!active && !active.kids
  const hasAverage = data?.average !== null && data?.average !== undefined && !!data?.countLabel

  // Guests: only when there is an average to show. Failures: nothing (it's an extra).
  if (status === 'loading' || (!data && !failed)) {
    if (!signedIn) return null
    return (
      <section id={id} aria-busy className="page-x scroll-mt-28">
        <div className="rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="mt-4 h-11 w-64 rounded-full" />
        </div>
      </section>
    )
  }
  if (failed || !data) return null
  if (!signedIn && !hasAverage) return null

  const friends = grownUp ? data.friends : []
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="page-x scroll-mt-28">
      <h2 id={id ? `${id}-title` : undefined} className="mb-3 font-display text-[21px] font-bold leading-tight sm:mb-4 sm:text-[26px]">
        {t('social.ratings.title')}
      </h2>
      <div className="divide-y divide-white/[0.07] rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6">
        {signedIn ? (
          <Row label={t('social.ratings.yours')}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <RatingStars value={mine} onChange={change} label={t('social.ratings.rateLabel', { title: media.title })} />
              {mine !== null && (
                // On phones it wraps under the stars: the negative margin lines its words up with the row.
                <Button type="button" variant="ghost" size="sm" className="-ms-3 h-11 px-3 text-white/70 sm:ms-0" onClick={() => change(null)}>
                  {t('social.ratings.clear')}
                </Button>
              )}
            </div>
            <AnimatePresence initial={false}>
              {hint && (
                <m.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: tween.base }}
                  exit={{ opacity: 0, transition: tween.fast }}
                  className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-white/60"
                >
                  <Info aria-hidden className="mt-px h-4 w-4 shrink-0 text-white/50" />
                  <span>
                    {t('social.ratings.firstHint')}{' '}
                    <Link href="/profile#privacy" className="font-medium text-white underline-offset-4 hover:underline">{t('social.ratings.sharing')}</Link>
                  </span>
                </m.p>
              )}
            </AnimatePresence>
          </Row>
        ) : (
          <Row label={t('social.ratings.yours')}>
            <Button asChild variant="secondary" className="h-11">
              <Link href={withCallback('/login', pathname)}>{t('social.ratings.signIn')}</Link>
            </Button>
          </Row>
        )}

        {friends.length > 0 && (
          <Row label={t('social.ratings.friends')}>
            <ul className="flex flex-wrap gap-2">
              {friends.slice(0, 6).map(({ person, stars }) => (
                <li key={person.handle}>
                  <Link
                    href={`/u/${person.handle}`}
                    aria-label={t('social.ratings.friendStars', { name: person.name, count: stars })}
                    className="pressable inline-flex h-11 items-center gap-2.5 rounded-full bg-white/[0.06] pe-4 ps-1.5 outline-none transition-colors hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <UserAvatar person={person} size={32} />
                    <bdi className="max-w-[9rem] truncate text-[13.5px] font-medium">{person.name}</bdi>
                    <StarsReadOnly stars={stars} size={12} />
                  </Link>
                </li>
              ))}
              {friends.length > 6 && (
                <li className="inline-flex h-11 items-center">
                  <AvatarStack people={friends.slice(6).map((friend) => friend.person)} total={friends.length - 6} size={32} />
                </li>
              )}
            </ul>
          </Row>
        )}

        {hasAverage && (
          <Row label={t('social.ratings.average')}>
            <RatingSummary average={data.average!} countLabel={data.countLabel!} />
          </Row>
        )}
      </div>
    </section>
  )
}
