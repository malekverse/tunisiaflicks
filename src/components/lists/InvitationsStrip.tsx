"use client"
// Invitations by name, at the top of /lists: who asks, which list, Join (white) or Decline. Saying
// no waits 5 seconds behind an Undo, and still goes out if the page is left meanwhile.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { Film } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import TmdbImage from '@/src/components/TmdbImage'
import { UserAvatar } from '@/src/components/social/Avatar'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import { richT } from '@/src/lib/i18n/rich'
import { haptic, spring, tween } from '@/src/lib/motion'
import type { ListInvitation } from '@/src/lib/shared-lists/types'
import { listErrorText, listFetch } from './list-client'

const UNDO_MS = 5000

export default function InvitationsStrip({ invitations, onJoined, onGone }: {
  invitations: ListInvitation[]
  /** Joined: the list is now one of theirs (reload). */
  onJoined: (invitation: ListInvitation) => void
  /** Declined for good (or no longer there): drop it. */
  onGone: (slug: string) => void
}) {
  const t = useT()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // Leaving the page doesn't cancel a "no": it goes out right away instead.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer, slug) => {
        clearTimeout(timer)
        listFetch(`/api/lists/${encodeURIComponent(slug)}/collaborators`, { method: 'POST', body: { decline: true } }).catch(() => undefined)
      })
      pending.clear()
    }
  }, [])

  const shown = invitations.filter((invitation) => !hidden.has(invitation.slug))

  const join = async (invitation: ListInvitation) => {
    setBusy(invitation.slug)
    try {
      await listFetch(`/api/lists/${encodeURIComponent(invitation.slug)}/collaborators`, { method: 'POST', body: { accept: true } })
      haptic(12)
      toast({ title: t('sharedLists.invitations.joined', { list: invitation.title }), duration: 2500 })
      onJoined(invitation)
    } catch (error) {
      toast({ variant: 'destructive', title: listErrorText(t, error) })
      if ((error as { status?: number })?.status === 404) onGone(invitation.slug)
    } finally {
      setBusy(null)
    }
  }

  const decline = (invitation: ListInvitation) => {
    setHidden((current) => new Set(current).add(invitation.slug))
    const timer = setTimeout(() => {
      timers.current.delete(invitation.slug)
      listFetch(`/api/lists/${encodeURIComponent(invitation.slug)}/collaborators`, { method: 'POST', body: { decline: true } })
        .then(() => onGone(invitation.slug))
        .catch((error) => {
          if ((error as { status?: number })?.status === 404) return onGone(invitation.slug)
          setHidden((current) => { const next = new Set(current); next.delete(invitation.slug); return next })
          toast({ variant: 'destructive', title: listErrorText(t, error) })
        })
    }, UNDO_MS)
    timers.current.set(invitation.slug, timer)
    toast({
      title: t('sharedLists.invitations.declined'),
      duration: UNDO_MS,
      action: {
        label: t('library.undo'),
        onClick: () => {
          clearTimeout(timer)
          timers.current.delete(invitation.slug)
          setHidden((current) => { const next = new Set(current); next.delete(invitation.slug); return next })
        },
      },
    })
  }

  if (shown.length === 0) return null
  return (
    <section aria-labelledby="list-invitations" className="page-x">
      <h2 id="list-invitations" className="mb-3 text-[13px] font-medium text-white/70">{t('sharedLists.invitations.title')}</h2>
      <ul className="grid gap-3 lg:grid-cols-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((invitation) => {
            const poster = invitation.posters.find(Boolean) ?? null
            return (
              <m.li
                key={invitation.slug}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: spring.ui }}
                exit={{ opacity: 0, scale: 0.97, transition: tween.fast }}
                className="relative flex flex-col gap-4 overflow-hidden rounded-[22px] bg-white/[0.05] p-4 ring-1 ring-white/[0.09] sm:flex-row sm:items-center sm:p-5"
              >
                {/* The person inviting you, as the room's light. */}
                {invitation.inviter && <div aria-hidden className="pointer-events-none absolute -start-12 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: invitation.inviter.color }} />}
                <Link href={`/lists/${invitation.slug}`} className="relative flex min-w-0 flex-1 items-center gap-4 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                  <span className="relative block h-[66px] w-11 shrink-0">
                    <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10">
                      {poster ? <TmdbImage kind="poster" path={poster} alt="" fill sizes="44px" className="object-cover" /> : <Film aria-hidden className="h-4 w-4 text-white/50" />}
                    </span>
                    {invitation.inviter && <UserAvatar person={invitation.inviter} size={24} className="absolute -bottom-1.5 -end-2.5 ring-2 ring-[#18181b]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-pretty text-[15px] leading-snug text-white/80">
                      {richT(t, 'sharedLists.banner.sentence', { name: invitation.inviter?.name ?? '?', list: invitation.title }, { bold: ['name', 'list'] })}
                    </span>
                    <span className="mt-1 block text-[13px] text-white/50">{invitation.count === 1 ? t('library.countOne') : t('library.count', { count: invitation.count })}</span>
                  </span>
                </Link>
                <span className="relative flex shrink-0 gap-2">
                  <Button variant="white" className="h-11 flex-1 px-5 sm:flex-none" disabled={busy === invitation.slug} onClick={() => join(invitation)}>{t('sharedLists.invitations.join')}</Button>
                  <Button variant="ghost" className="h-11 px-5 ring-1 ring-inset ring-white/[0.12]" disabled={busy === invitation.slug} onClick={() => decline(invitation)}>{t('sharedLists.invitations.decline')}</Button>
                </span>
              </m.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </section>
  )
}
