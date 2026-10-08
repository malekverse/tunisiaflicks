"use client"
// One inbox row: who or what (a poster, a picture or an avatar), one sentence, an optional note,
// how long ago, a red dot while unread, and the inline answer when the row asks for one. The whole
// row is a link; the answer buttons sit beside it, never inside it.
import { createContext, useContext, useState } from 'react'
import Link from 'next/link'
import { Check, Film, X } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import TmdbImage from '@/src/components/TmdbImage'
import { UserAvatar } from '@/src/components/social/Avatar'
import { StarsReadOnly } from '@/src/components/social/RatingStars'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import type { TKey, Translate } from '@/src/lib/i18n'
import { richT } from '@/src/lib/i18n/rich'
import { haptic } from '@/src/lib/motion'
import { RELEASE_KINDS, type NotificationItem } from '@/src/lib/models/Follow'
import type { InboxAction, InboxActionType } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'

/** Rows in the phone sheet get finger-sized buttons (the desktop popover keeps them compact on a mouse). */
export const InboxTouchContext = createContext(false)

const UNDO_MS = 5000

const isRelease = (item: NotificationItem) => RELEASE_KINDS.includes(item.kind)

export function timeAgo(iso: string, locale: string | undefined) {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 60) return format.format(-Math.max(minutes, 1), 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return format.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  return days < 30 ? format.format(-days, 'day') : new Date(iso).toLocaleDateString(locale)
}

/** Release alerts keep their original wording. */
function releaseLine(item: NotificationItem, t: Translate) {
  if (item.kind === 'movie_released') return t('alerts.outNow')
  if (!item.episode) return t('alerts.newEpisode')
  const code = t('common.seasonEpisode', { season: item.episode.season, episode: item.episode.episode })
  return t('alerts.newEpisodeCode', { episode: code })
}

/**
 * "Sami", "Sami and one other", "Sami and 3 others": as text (for the link's label) and as nodes
 * where only the name is isolated, so the phrase around it follows the interface's direction.
 */
function actorName(item: NotificationItem, t: Translate): { text: string; node: React.ReactNode } {
  const name = item.actor?.name ?? (typeof item.text?.vars?.name === 'string' ? item.text.vars.name : t('social.inbox.someone'))
  const others = item.others ?? 0
  if (others <= 0) return { text: name, node: name }
  const key = others === 1 ? 'social.inbox.andOne' : 'social.inbox.andOthers'
  return { text: t(key, { name, count: others }), node: richT(t, key, { name, count: others }) }
}

/** What the row's answer buttons say and do. */
const ACTIONS: Record<InboxActionType, { yes: TKey; no: TKey; noToast: TKey; request: (action: InboxAction, yes: boolean) => [string, RequestInit] }> = {
  friend_request: {
    yes: 'social.inbox.accept', no: 'social.inbox.decline', noToast: 'social.inbox.declinedToast',
    request: (action, yes) => ['/api/social/requests', { method: 'PATCH', body: JSON.stringify({ id: action.id, accept: yes }) }],
  },
  night_invite: {
    yes: 'social.inbox.going', no: 'social.inbox.cantGo', noToast: 'social.inbox.cantGoToast',
    request: (action, yes) => [`/api/movie-night/${encodeURIComponent(action.id)}`, { method: 'POST', body: JSON.stringify({ action: 'rsvp', going: yes }) }],
  },
  night_join: {
    yes: 'social.inbox.approve', no: 'social.inbox.decline', noToast: 'social.inbox.declinedToast',
    request: (action, yes) => {
      const [nightId, profileId] = action.id.split(':')
      return [`/api/movie-night/${encodeURIComponent(nightId)}`, { method: 'POST', body: JSON.stringify({ action: 'approve', profileId, approve: yes }) }]
    },
  },
  list_invite: {
    yes: 'social.inbox.join', no: 'social.inbox.decline', noToast: 'social.inbox.declinedToast',
    request: (action, yes) => [`/api/lists/${encodeURIComponent(action.id)}/collaborators`, { method: 'POST', body: JSON.stringify(yes ? { accept: true } : { decline: true }) }],
  },
}

async function answer(action: InboxAction, yes: boolean) {
  const [url, init] = ACTIONS[action.type].request(action, yes)
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } })
  // Already answered elsewhere counts as done.
  if (!response.ok && response.status !== 404 && response.status !== 409) throw new Error(String(response.status))
}

function Visual({ item }: { item: NotificationItem }) {
  if (item.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.image} alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
  }
  const poster = item.media?.poster_path ?? item.poster_path ?? null
  const hasPoster = !!item.media || isRelease(item)
  if (hasPoster) {
    return (
      <span className="relative block h-[60px] w-10 shrink-0">
        <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
          {/* A title with no poster on TMDB gets a quiet frame, not the 404 artwork. */}
          {poster
            ? <TmdbImage kind="poster" path={poster} alt="" fill sizes="40px" className="object-cover" />
            : <Film aria-hidden className="h-4 w-4 text-white/40" strokeWidth={1.8} />}
        </span>
        {item.actor && <UserAvatar person={item.actor} size={24} className="absolute -bottom-1.5 -end-2 ring-2 ring-[#141416]" />}
      </span>
    )
  }
  if (item.actor) return <UserAvatar person={item.actor} size={40} />
  return <span className="h-10 w-10 shrink-0 rounded-full bg-white/[0.08]" />
}

export function InboxItem({ item, onChange }: { item: NotificationItem; onChange?: (i: NotificationItem) => void }): JSX.Element {
  const { t, dateLocale } = useI18n()
  const touch = useContext(InboxTouchContext)
  const [busy, setBusy] = useState(false)
  const release = isRelease(item)
  const title = item.media?.title ?? item.title ?? ''
  const actor = actorName(item, t)
  const textKey = item.text?.key as TKey | undefined
  const vars = { ...(item.text?.vars ?? {}), name: actor.text, title }

  const line1 = release || !textKey
    ? <strong className="font-semibold text-white"><bdi>{title}</bdi></strong>
    : richT(t, textKey, { ...vars, name: actor.node }, { bold: ['name', 'title'] })
  const sentence = release || !textKey
    ? [title, releaseLine(item, t), item.episode?.name].filter(Boolean).join('. ')
    : t(textKey, vars)
  const plain = [sentence, !release && item.note ? item.note : null, timeAgo(item.created_at, dateLocale)].filter(Boolean).join('. ')
  const stars = item.kind === 'friend_rated' && typeof item.text?.vars?.stars === 'number' ? item.text.vars.stars : null
  const action = item.action
  const pending = action?.state === 'pending'

  const settle = (state: 'accepted' | 'declined' | 'pending') => {
    if (!action) return
    onChange?.({ ...item, read: true, action: { ...action, state } })
  }

  const yes = async () => {
    if (!action || busy) return
    setBusy(true)
    try {
      await answer(action, true)
      haptic(10)
      settle('accepted')
    } catch {
      toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
    } finally {
      setBusy(false)
    }
  }

  // Saying no waits 5 seconds behind an Undo (and goes out even if the inbox closes meanwhile).
  const no = () => {
    if (!action || busy) return
    settle('declined')
    const timer = setTimeout(() => {
      answer(action, false).catch(() => {
        settle('pending')
        toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
      })
    }, UNDO_MS)
    toast({
      title: t(ACTIONS[action.type].noToast),
      duration: UNDO_MS,
      action: { label: t('social.inbox.undo'), onClick: () => { clearTimeout(timer); settle('pending') } },
    })
  }

  const buttonSize = touch ? 'h-11 px-5 text-[14px]' : 'h-9 px-4 text-[13px] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-5'

  return (
    <article className="group relative flex gap-3 rounded-2xl p-2.5 transition-colors duration-150 hover:bg-white/[0.05] focus-within:bg-white/[0.06]">
      <Link href={item.href || '/'} aria-label={plain} className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500" />
      <span aria-hidden className="pointer-events-none relative shrink-0"><Visual item={item} /></span>
      <div className="relative min-w-0 flex-1">
        {/* The link reads the sentence out; this is the same thing, for the eyes. */}
        <div aria-hidden className="pointer-events-none">
          <p className="text-[14.5px] leading-snug text-white/80">{line1}</p>
          {release && (
            <p className="mt-0.5 line-clamp-2 text-[13px] text-white/60">
              {/* Separate spans, never a joined meta string. */}
              <span className="flex flex-wrap gap-x-3">
                <span>{releaseLine(item, t)}</span>
                {item.episode?.name && <bdi className="min-w-0 truncate">{item.episode.name}</bdi>}
              </span>
            </p>
          )}
          {!release && item.note && <p dir="auto" className="mt-1 line-clamp-2 text-[13px] leading-snug text-white/60">{item.note}</p>}
          {stars !== null && <StarsReadOnly stars={stars} size={12} className="mt-1.5" />}
          {/* Relative to now: the server's render and the browser's may differ by a minute. */}
          <p suppressHydrationWarning className="mt-1 text-[11px] text-white/50">{timeAgo(item.created_at, dateLocale)}</p>
        </div>
        {action && pending && (
          <div className="pointer-events-auto relative z-10 mt-2.5 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={yes} disabled={busy} className={buttonSize}>{t(ACTIONS[action.type].yes)}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={no} disabled={busy} className={cn(buttonSize, 'ring-1 ring-inset ring-white/[0.12]')}>{t(ACTIONS[action.type].no)}</Button>
          </div>
        )}
        {action && !pending && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-white/55">
            {action.state === 'accepted' ? <Check aria-hidden className="h-3.5 w-3.5" /> : <X aria-hidden className="h-3.5 w-3.5" />}
            {t(action.state === 'accepted' ? 'social.inbox.accepted' : 'social.inbox.declined')}
          </p>
        )}
      </div>
      {!item.read && (
        <span className="pointer-events-none relative mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgb(255_36_20)]">
          <span className="sr-only">{t('alerts.unread')}</span>
        </span>
      )}
      {item.read && <span aria-hidden className={cn('w-2 shrink-0')} />}
    </article>
  )
}
