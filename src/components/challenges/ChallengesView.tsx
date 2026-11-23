"use client"
// /challenges: this month's three challenges, how far you've got (a bar each), how your friends
// are doing (their faces along each bar), and your score in the months before. Signed out: the
// challenges, and a way in.
import React from 'react'
import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import {
  CalendarCheck, Check, Clapperboard, Film, Flag, Hourglass, Languages, LogIn, MessageSquareText, Palette, Shapes, Sparkles,
  Target, Trophy, Tv, UserPlus, Video, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { UserAvatar } from '@/src/components/social/Avatar'
import { useI18n } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import type { Challenge, ChallengeKind, ChallengeProgress } from '@/src/lib/badges/challenges'
import type { ChallengeFriend, PastMonth } from '@/src/lib/badges/challenges-view'
import type { TKey } from '@/src/lib/i18n'
import { EASE_OUT } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

const ICON: Record<ChallengeKind, LucideIcon> = {
  films: Film, languages: Languages, decades: Hourglass, genres: Shapes, tunisian: Flag, arabic: MessageSquareText,
  classics: Clapperboard, episodes: Tv, days: CalendarCheck, newReleases: Sparkles, animation: Palette, documentary: Video,
}
const LABEL: Record<ChallengeKind, TKey> = {
  films: 'challenges.kind.films', languages: 'challenges.kind.languages', decades: 'challenges.kind.decades', genres: 'challenges.kind.genres',
  tunisian: 'challenges.kind.tunisian', arabic: 'challenges.kind.arabic', classics: 'challenges.kind.classics', episodes: 'challenges.kind.episodes',
  days: 'challenges.kind.days', newReleases: 'challenges.kind.newReleases', animation: 'challenges.kind.animation', documentary: 'challenges.kind.documentary',
}

export type ChallengesData =
  | { signedIn: false, month: string, daysLeft: number, challenges: Challenge[] }
  | {
    signedIn: true
    month: string
    daysLeft: number
    enabled: boolean
    incomplete: boolean
    challenges: ChallengeProgress[]
    past: PastMonth[]
    friends: ChallengeFriend[] | null
  }

const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6'

export default function ChallengesView({ data }: { data: ChallengesData }) {
  const { t, dateLocale } = useI18n()
  const monthName = (month: string, withYear = true) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString(dateLocale, { month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  const doneCount = data.signedIn ? data.challenges.filter((challenge) => challenge.done).length : 0

  return (
    <div className="page-top pb-16">
      <div className="page-x">
        <div className="mx-auto max-w-[1000px]">
          <header className="relative isolate overflow-hidden rounded-stage bg-gradient-to-br from-red-600/25 via-white/[0.04] to-transparent p-6 ring-1 ring-white/10 rtl:bg-gradient-to-bl sm:p-10">
            <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-80 w-80 rounded-full bg-red-600/25 blur-3xl" />
            <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-red-600 text-white shadow-[0_16px_40px_-10px_rgb(var(--red-600)/0.8)]"><Target aria-hidden className="h-7 w-7" /></span>
            <h1 className="mt-5 font-display text-[clamp(34px,5vw,60px)] font-extrabold leading-[0.95] text-white">{t('challenges.title', { month: monthName(data.month, false) })}</h1>
            <p className="mt-3 max-w-[56ch] text-[15.5px] leading-relaxed text-white/70">{t('challenges.subtitle')}</p>
            <p className="mt-5 flex flex-wrap gap-2 text-[14px] font-medium">
              <span className="rounded-full bg-white/[0.08] px-3.5 py-1.5 text-white/85">{data.daysLeft > 0 ? t('challenges.daysLeft', { count: data.daysLeft }) : t('challenges.lastDay')}</span>
              {data.signedIn && <span className={cn('rounded-full px-3.5 py-1.5', doneCount === data.challenges.length && doneCount > 0 ? 'bg-white text-black' : 'bg-white/[0.08] text-white/85')}>{t('challenges.doneCount', { done: doneCount, total: data.challenges.length })}</span>}
            </p>
          </header>

          {data.signedIn && !data.enabled && (
            <div className={cn(panel, 'mt-6 flex flex-wrap items-center gap-4')}>
              <p className="min-w-0 flex-1 text-[14.5px] text-white/75">{t('challenges.off')}</p>
              <Button asChild variant="secondary"><Link href="/settings#privacy">{t('challenges.turnOn')}</Link></Button>
            </div>
          )}

          <ol className="mt-6 grid gap-3 lg:grid-cols-3">
            {data.challenges.map((challenge, index) => (
              <ChallengeCard
                key={challenge.kind}
                challenge={challenge}
                progress={data.signedIn ? (challenge as ChallengeProgress) : null}
                friends={data.signedIn && data.friends ? data.friends.map((friend) => ({ friend, value: friend.values[index] ?? 0 })) : []}
              />
            ))}
          </ol>
          {data.signedIn && data.incomplete && <p className="mt-3 text-[12.5px] text-white/50">{t('challenges.incomplete')}</p>}

          {!data.signedIn && (
            <div className={cn(panel, 'mt-6 text-center')}>
              <p className="text-[15px] text-white/75">{t('challenges.signIn')}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <Button asChild><Link href={withCallback('/login', '/challenges')}><LogIn aria-hidden className="h-4 w-4" />{t('challenges.signInButton')}</Link></Button>
                <Button asChild variant="secondary"><Link href={withCallback('/signup', '/challenges')}>{t('challenges.signUp')}</Link></Button>
              </div>
            </div>
          )}

          {data.signedIn && data.friends === null && (
            <div className={cn(panel, 'mt-6 flex flex-wrap items-center gap-4')}>
              <UserPlus aria-hidden className="h-5 w-5 shrink-0 text-white/70" />
              <p className="min-w-0 flex-1 text-[14px] text-white/70">{t('challenges.noPage')}</p>
              <Button asChild variant="secondary"><Link href="/friends">{t('challenges.toFriends')}</Link></Button>
            </div>
          )}
          {data.signedIn && data.friends && data.friends.length === 0 && (
            <p className="mt-6 text-center text-[13.5px] text-white/55">{t('challenges.noFriends')}</p>
          )}

          {data.signedIn && data.past.length > 0 && (
            <section aria-labelledby="challenges-past" className="mt-10">
              <h2 id="challenges-past" className="font-display text-[22px] font-bold sm:text-[26px]">{t('challenges.past')}</h2>
              <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {data.past.map((past) => (
                  <li key={past.month} className={cn('flex items-center gap-3 rounded-[18px] px-4 py-3 ring-1 ring-inset', past.done === past.total ? 'bg-amber-300/10 ring-amber-300/25' : 'bg-white/[0.04] ring-white/[0.07]')}>
                    <Trophy aria-hidden className={cn('h-5 w-5 shrink-0', past.done === past.total ? 'text-amber-300' : past.done > 0 ? 'text-white/70' : 'text-white/25')} />
                    <span className="min-w-0 flex-1 truncate text-[14px] capitalize text-white/85">{monthName(past.month)}</span>
                    <span className="shrink-0 text-[13.5px] font-semibold text-white" dir="ltr">{past.done}/{past.total}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-8 flex items-start gap-2 text-[12.5px] leading-relaxed text-white/50"><Trophy aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('challenges.rules')}</p>
        </div>
      </div>
    </div>
  )
}

function ChallengeCard({ challenge, progress, friends }: { challenge: Challenge, progress: ChallengeProgress | null, friends: { friend: ChallengeFriend, value: number }[] }) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const Icon = ICON[challenge.kind]
  const value = progress ? Math.min(progress.value, challenge.target) : 0
  const done = progress?.done === true
  const ranked = [...friends].sort((a, b) => b.value - a.value)
  return (
    <li className={cn(panel, 'flex flex-col', done && 'ring-emerald-400/30')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', done ? 'bg-emerald-400 text-black' : 'bg-white/[0.07] text-red-400')}>
          {done ? <Check aria-hidden className="h-5 w-5" strokeWidth={3} /> : <Icon aria-hidden className="h-5 w-5" />}
        </span>
        <h3 className="pt-2 text-[16.5px] font-semibold leading-snug text-white">{t(LABEL[challenge.kind], { count: challenge.target })}</h3>
      </div>
      {progress && (
        <>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={challenge.target} aria-valuenow={value} aria-label={t(LABEL[challenge.kind], { count: challenge.target })}>
            <m.div
              className={cn('h-full rounded-full', done ? 'bg-emerald-400' : 'bg-red-500')}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${(value / challenge.target) * 100}%` }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
            />
          </div>
          <p className="mt-2 text-[13.5px] text-white/65">{done ? t('challenges.done') : t('badges.progress', { value: progress.value, target: challenge.target })}</p>
        </>
      )}
      {ranked.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4" aria-label={t('challenges.friends')}>
          {ranked.slice(0, 8).map(({ friend, value: friendValue }) => {
            const friendDone = friendValue >= challenge.target
            return (
              <li key={friend.identity.handle} title={`${friend.identity.name}: ${Math.min(friendValue, challenge.target)}/${challenge.target}`} className="flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pe-2.5 ps-1">
                <span className={cn('relative rounded-full', friendDone && 'ring-2 ring-emerald-400')}><UserAvatar person={friend.identity} size={24} /></span>
                <span className="max-w-[90px] truncate text-[12.5px] text-white/80">{friend.identity.name}</span>
                <span className={cn('text-[12px] font-semibold', friendDone ? 'text-emerald-300' : 'text-white/55')} dir="ltr">{friendDone ? '✓' : `${friendValue}/${challenge.target}`}</span>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
