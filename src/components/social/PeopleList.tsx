"use client"
// /friends/list: requests (#requests) to answer and the ones you sent, your friends, and adding a
// friend (#add) by exact handle or with the invite link. Accepting moves the person into Friends
// (the row leaves, the list makes room); declining waits 5 seconds behind an Undo. Removing and
// blocking are behind a confirm dialog, and neither is ever announced to the other person.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from 'framer-motion'
import { Ban, MoreHorizontal, RotateCw, UserMinus, UsersRound } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu'
import { Skeleton } from '@/src/components/ui/skeleton'
import { toast } from '@/src/hooks/use-toast'
import { haptic, spring, tween } from '@/src/lib/motion'
import type { PublicIdentity } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'
import AddFriendCard from './AddFriendCard'
import PersonRow, { ConfirmDialog } from './PersonRow'
import { socialErrorText } from './use-social-self'

type Request = { id: string; person: PublicIdentity; createdAt: string }
type Friend = { person: PublicIdentity; since: string }
type Lists = { friends: Friend[]; incoming: Request[]; outgoing: Request[] }

const UNDO_MS = 5000
const SECTION = 'scroll-mt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+20px)]'
const PANEL = 'overflow-hidden rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07]'
/** Finger-sized on touch screens, compact with a mouse. */
const ROW_BUTTON = 'h-9 px-4 text-[13px] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:px-5 [@media(pointer:coarse)]:text-[14px]'

const byName = (a: Friend, b: Friend) => a.person.name.localeCompare(b.person.name)

function SectionTitle({ id, children, count }: { id: string; children: React.ReactNode; count?: number }) {
  return (
    <h2 id={id} className="mb-3 flex items-baseline gap-2.5 font-display text-[21px] font-bold leading-tight text-white sm:text-[24px]">
      {children}
      {count !== undefined && count > 0 && <span className="font-sans text-[15px] font-medium tabular-nums text-white/50">{count}</span>}
    </h2>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy className={cn(PANEL, 'divide-y divide-white/[0.06]')}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3 rounded-full" /><Skeleton className="h-3 w-1/4 rounded-full" /></div>
        </div>
      ))}
    </div>
  )
}

export default function PeopleList({ handle, name }: { handle: string; name: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const still = useReducedMotion()
  const [lists, setLists] = useState<Lists | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'remove' | 'block'; person: PublicIdentity } | null>(null)
  const pendingDeclines = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/social/friends', { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      // A decline still waiting out its Undo stays hidden.
      const waiting = pendingDeclines.current
      setLists({
        friends: data.friends ?? [],
        incoming: (data.incoming ?? []).filter((request: Request) => !waiting.has(request.id)),
        outgoing: data.outgoing ?? [],
      })
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Arriving at #requests or #add: the sections appear with their data, so bring them into view then.
  const scrolled = useRef(false)
  useEffect(() => {
    if (!lists || scrolled.current) return
    scrolled.current = true
    const hash = window.location.hash.slice(1)
    if (hash === 'requests' || hash === 'add') requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }))
  }, [lists])

  // A decline still waiting out its Undo goes out even if the reader moves on to another page
  // (the timer outlives this component, like the inbox's).

  /** The tabs' request count and the menu tile follow (server components refresh). */
  const refreshCounts = () => router.refresh()

  const accept = async (request: Request) => {
    if (busy) return
    setBusy(request.id)
    try {
      const response = await fetch('/api/social/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: request.id, accept: true }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 404) throw body
      haptic(10)
      if (response.ok) toast({ title: t('social.list.acceptedToast', { name: request.person.name }) })
      setLists((current) => current && ({
        ...current,
        incoming: current.incoming.filter((entry) => entry.id !== request.id),
        friends: response.ok ? [...current.friends.filter((friend) => friend.person.handle !== request.person.handle), { person: request.person, since: new Date().toISOString() }].sort(byName) : current.friends,
      }))
      refreshCounts()
    } catch (error) {
      toast({ variant: 'destructive', title: error && typeof error === 'object' && 'code' in error ? socialErrorText(t, error as { code?: string }) : t('social.inbox.actionFailed') })
    } finally {
      setBusy(null)
    }
  }

  // Declining waits 5 seconds behind an Undo.
  const decline = (request: Request) => {
    setLists((current) => current && ({ ...current, incoming: current.incoming.filter((entry) => entry.id !== request.id) }))
    const timer = setTimeout(async () => {
      pendingDeclines.current.delete(request.id)
      try {
        const response = await fetch('/api/social/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: request.id, accept: false }) })
        if (!response.ok && response.status !== 404) throw new Error(String(response.status))
        refreshCounts()
      } catch {
        toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
        void load()
      }
    }, UNDO_MS)
    pendingDeclines.current.set(request.id, timer)
    toast({
      title: t('social.inbox.declinedToast'),
      duration: UNDO_MS,
      action: {
        label: t('social.inbox.undo'),
        onClick: () => {
          clearTimeout(timer)
          pendingDeclines.current.delete(request.id)
          setLists((current) => current && ({ ...current, incoming: [request, ...current.incoming.filter((entry) => entry.id !== request.id)] }))
        },
      },
    })
  }

  const cancel = async (request: Request) => {
    if (busy) return
    setBusy(request.id)
    try {
      const response = await fetch(`/api/social/requests?id=${encodeURIComponent(request.id)}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) throw new Error(String(response.status))
      setLists((current) => current && ({ ...current, outgoing: current.outgoing.filter((entry) => entry.id !== request.id) }))
    } catch {
      toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
    } finally {
      setBusy(null)
    }
  }

  const removeOrBlock = async () => {
    if (!confirm) return
    const { kind, person } = confirm
    setBusy(person.handle)
    try {
      const query = new URLSearchParams({ handle: person.handle, ...(kind === 'block' ? { block: '1' } : {}) })
      const response = await fetch(`/api/social/friends?${query}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) throw new Error(String(response.status))
      setLists((current) => current && ({ ...current, friends: current.friends.filter((friend) => friend.person.handle !== person.handle) }))
      setConfirm(null)
      refreshCounts()
    } catch {
      toast({ variant: 'destructive', title: t('social.inbox.actionFailed') })
    } finally {
      setBusy(null)
    }
  }

  const rowMotion = {
    layout: !still,
    initial: still ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: tween.fast },
    transition: { ...spring.ui, opacity: tween.base },
  } as const

  const requests = lists ? lists.incoming.length + lists.outgoing.length : 0

  return (
    <div className="page-x">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-14">
        <div className="min-w-0 space-y-10">
          {failed && !lists && (
            <div className={cn(PANEL, 'flex flex-wrap items-center gap-3 p-5')}>
              <p className="text-[14px] text-white/65">{t('social.picker.loadFailed')}</p>
              <Button variant="secondary" className="h-11" onClick={() => void load()}><RotateCw aria-hidden className="h-4 w-4" />{t('social.inbox.retry')}</Button>
            </div>
          )}

          <LayoutGroup>
            <section id="requests" aria-labelledby="requests-title" className={SECTION}>
              <SectionTitle id="requests-title" count={requests}>{t('social.list.requests')}</SectionTitle>
              {!lists && !failed ? <ListSkeleton rows={1} /> : lists && (
                <m.div layout={!still} transition={spring.ui} className={cn(PANEL, 'divide-y divide-white/[0.06]')}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {lists.incoming.map((request) => (
                      <m.div key={`in-${request.id}`} {...rowMotion}>
                        <PersonRow person={request.person}>
                          <div className="flex gap-2">
                            <Button size="sm" className={ROW_BUTTON} onClick={() => void accept(request)} disabled={busy === request.id} aria-label={t('social.list.acceptName', { name: request.person.name })}>
                              {t('social.inbox.accept')}
                            </Button>
                            <Button size="sm" variant="ghost" className={cn(ROW_BUTTON, 'ring-1 ring-inset ring-white/[0.12]')} onClick={() => decline(request)} disabled={busy === request.id} aria-label={t('social.list.declineName', { name: request.person.name })}>
                              {t('social.inbox.decline')}
                            </Button>
                          </div>
                        </PersonRow>
                      </m.div>
                    ))}
                    {lists.outgoing.map((request) => (
                      <m.div key={`out-${request.id}`} {...rowMotion}>
                        <PersonRow person={request.person}>
                          <span className="hidden text-[13px] text-white/55 sm:inline">{t('social.list.requested')}</span>
                          <Button size="sm" variant="ghost" className={cn(ROW_BUTTON, 'ring-1 ring-inset ring-white/[0.12]')} onClick={() => void cancel(request)} disabled={busy === request.id} aria-label={t('social.list.cancelName', { name: request.person.name })}>
                            {t('common.cancel')}
                          </Button>
                        </PersonRow>
                      </m.div>
                    ))}
                    {requests === 0 && (
                      <m.p key="none" {...rowMotion} layout={false} className="px-5 py-4 text-[14px] text-white/55">{t('social.list.noRequests')}</m.p>
                    )}
                  </AnimatePresence>
                </m.div>
              )}
            </section>

            <m.section layout={!still} transition={spring.ui} aria-labelledby="friends-title">
              <SectionTitle id="friends-title" count={lists?.friends.length}>{t('social.nav')}</SectionTitle>
              {!lists && !failed ? <ListSkeleton rows={3} /> : lists && (lists.friends.length === 0 ? (
                <div className={cn(PANEL, 'flex items-start gap-4 p-5')}>
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><UsersRound className="h-5 w-5 text-white/70" /></span>
                  <div>
                    <p className="text-[15px] font-semibold text-white">{t('social.picker.empty')}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-white/60">{t('social.picker.emptyText')}</p>
                  </div>
                </div>
              ) : (
                <div className={cn(PANEL, 'divide-y divide-white/[0.06]')}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {lists.friends.map((friend) => (
                      <m.div key={friend.person.handle} {...rowMotion}>
                        <PersonRow person={friend.person}>
                          {/* modal={false}: the confirm dialog opens right after, and must get the focus. */}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={t('social.list.menu', { name: friend.person.name })}
                                className="pressable grid h-11 w-11 place-items-center rounded-full text-white/65 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500 data-[state=open]:bg-white/[0.1] data-[state=open]:text-white"
                              >
                                <MoreHorizontal aria-hidden className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[13rem]">
                              <DropdownMenuItem className="min-h-11 gap-3 text-[14px]" onSelect={() => setConfirm({ kind: 'remove', person: friend.person })}>
                                <UserMinus aria-hidden className="h-4 w-4" />{t('social.list.remove')}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="min-h-11 gap-3 text-[14px]" onSelect={() => setConfirm({ kind: 'block', person: friend.person })}>
                                <Ban aria-hidden className="h-4 w-4" />{t('social.list.block')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </PersonRow>
                      </m.div>
                    ))}
                  </AnimatePresence>
                </div>
              ))}
            </m.section>
          </LayoutGroup>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--topbar)+env(safe-area-inset-top,0px)+20px)]">
          <AddFriendCard handle={handle} name={name} onChange={() => { void load(); refreshCounts() }} />
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        title={confirm ? t(confirm.kind === 'remove' ? 'social.list.removeTitle' : 'social.list.blockTitle', { name: confirm.person.name }) : ''}
        text={confirm ? t(confirm.kind === 'remove' ? 'social.list.removeText' : 'social.list.blockText') : ''}
        confirm={confirm?.kind === 'block' ? t('social.list.block') : t('social.list.removeConfirm')}
        onConfirm={() => void removeOrBlock()}
        busy={!!busy}
      />
    </div>
  )
}
