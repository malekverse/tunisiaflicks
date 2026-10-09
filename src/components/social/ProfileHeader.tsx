"use client"
// The top of someone's page (/u/[handle]): their face (96, 128 from md), name, @handle, since when
// you are friends, their few words, their badges, and what you can do: Add friend / Requested /
// Accept and Decline / Friends (Remove, Block), and Share. On your own page: Edit and Share.
// Never a friend count. Every answer refreshes the server parts of the page.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Check, ChevronDown, Clock3, MoreHorizontal, Pencil, Share2, UserMinus, UserPlus, X } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu'
import { toast } from '@/src/hooks/use-toast'
import { haptic } from '@/src/lib/motion'
import type { PublicIdentity, Relationship } from '@/src/lib/social/types'
import { cn } from '@/src/lib/utils'
import { openShare } from '@/src/store/share-sheet'
import { UserAvatar } from './Avatar'
import { ConfirmDialog } from './PersonRow'
import ProfileSetupCard from './ProfileSetupCard'
import { socialErrorText } from './use-social-self'

const UNDO_MS = 5000

export default function ProfileHeader({ person, bio, isOwner, viewer, relationship: initial, requestId, friendsSince, requestsOff, shareUrl, loginHref, badges, belowBanner, invitePending }: {
  person: PublicIdentity
  bio: string
  isOwner: boolean
  /** member: a grown-up with a page; setup: a grown-up without one yet; guest; other (a TV). */
  viewer: 'member' | 'setup' | 'guest' | 'other'
  relationship: Relationship
  /** The pending request between you (to answer or cancel it). */
  requestId: string | null
  /** 'March 2025', already in the reader's language. */
  friendsSince: string | null
  /** They take no friend requests (an invite link still works). */
  requestsOff: boolean
  /** What Share gives out: the owner's private link on their own page, the plain address otherwise. */
  shareUrl: string
  loginHref: string
  badges?: React.ReactNode
  /** An invitation banner sits above: it already clears the top bar. */
  belowBanner?: boolean
  /** That banner offers to become friends: no second 'Add friend' beside it. */
  invitePending?: boolean
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [relation, setRelation] = useState<Relationship>(initial)
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState(false)
  const [confirm, setConfirm] = useState<'remove' | 'block' | null>(null)
  // The page refreshes after every answer: follow what the server says now.
  useEffect(() => { setRelation(initial) }, [initial])

  const share = () => openShare({
    kind: 'invite',
    target: 'friend',
    url: shareUrl,
    title: t('social.page.metaTitle', { name: person.name }),
    text: t('social.page.shareText', { name: person.name }),
  })

  const fail = (body?: { code?: unknown } | null) => toast({ variant: 'destructive', title: body?.code ? socialErrorText(t, body) : t('social.inbox.actionFailed') })

  const addFriend = async () => {
    if (busy) return
    if (viewer === 'setup') return setSetup(true)
    setBusy(true)
    try {
      const response = await fetch('/api/social/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: person.handle }) })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409 && body.code === 'needs_handle') return setSetup(true)
      if (!response.ok) return fail(body)
      haptic(10)
      if (body.status === 'friends') {
        setRelation('friends')
        toast({ title: t('social.list.acceptedToast', { name: person.name }) })
      } else {
        setRelation('outgoing')
        toast({ title: t('social.add.sent') })
      }
      router.refresh()
    } catch {
      fail()
    } finally {
      setBusy(false)
    }
  }

  const answer = async (accept: boolean) => {
    if (!requestId || busy) return
    if (!accept) {
      // Declining waits 5 seconds behind an Undo.
      setRelation('none')
      const timer = setTimeout(() => {
        fetch('/api/social/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: requestId, accept: false }) })
          .then((response) => { if (!response.ok && response.status !== 404) throw new Error(String(response.status)) })
          .then(() => router.refresh())
          .catch(() => { setRelation('incoming'); fail() })
      }, UNDO_MS)
      toast({
        title: t('social.inbox.declinedToast'),
        duration: UNDO_MS,
        action: { label: t('social.inbox.undo'), onClick: () => { clearTimeout(timer); setRelation('incoming') } },
      })
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/social/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: requestId, accept: true }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) return fail(body)
      haptic(10)
      setRelation('friends')
      toast({ title: t('social.list.acceptedToast', { name: person.name }) })
      router.refresh()
    } catch {
      fail()
    } finally {
      setBusy(false)
    }
  }

  const cancelRequest = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (!requestId) return
      const response = await fetch(`/api/social/requests?id=${encodeURIComponent(requestId)}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) return fail(await response.json().catch(() => null))
      setRelation('none')
      router.refresh()
    } catch {
      fail()
    } finally {
      setBusy(false)
    }
  }

  const removeOrBlock = async () => {
    if (!confirm || busy) return
    setBusy(true)
    try {
      const query = new URLSearchParams({ handle: person.handle, ...(confirm === 'block' ? { block: '1' } : {}) })
      const response = await fetch(`/api/social/friends?${query}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) return fail(await response.json().catch(() => null))
      if (confirm === 'block') {
        // Their page is gone for you now (and yours for them).
        toast({ title: t('social.page.blocked') })
        router.replace('/friends/list')
        return
      }
      setRelation('none')
      setConfirm(null)
      router.refresh()
    } catch {
      fail()
    } finally {
      setBusy(false)
    }
  }

  const big = 'h-12 px-6 text-[15px]'
  const menuItem = 'min-h-11 gap-3 text-[14px]'
  const shareButton = (
    <Button variant="secondary" className={big} onClick={share}>
      <Share2 aria-hidden className="h-[18px] w-[18px]" />{t('social.page.share')}
    </Button>
  )
  const blockMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('social.page.more')}
          className="pressable grid h-12 w-12 place-items-center rounded-full bg-white/[0.1] text-white/80 outline-none backdrop-blur-md transition-colors hover:bg-white/[0.16] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <MoreHorizontal aria-hidden className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuItem className={menuItem} onSelect={() => setConfirm('block')}><Ban aria-hidden className="h-4 w-4" />{t('social.list.block')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  let actions: React.ReactNode
  if (isOwner) {
    actions = (
      <>
        <Button asChild variant="secondary" className={big}><Link href="/profile#privacy"><Pencil aria-hidden className="h-[18px] w-[18px]" />{t('social.page.edit')}</Link></Button>
        {shareButton}
      </>
    )
  } else if (viewer === 'guest') {
    actions = (
      <>
        {!requestsOff && !invitePending && <Button asChild className={big}><Link href={loginHref}><UserPlus aria-hidden className="h-[18px] w-[18px]" />{t('social.add.addFriend')}</Link></Button>}
        {shareButton}
      </>
    )
  } else if (viewer === 'other') {
    actions = shareButton
  } else if (relation === 'friends') {
    actions = (
      <>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className={cn(big, 'data-[state=open]:bg-white/[0.16]')}>
              <Check aria-hidden className="h-[18px] w-[18px]" />{t('social.add.friends')}<ChevronDown aria-hidden className="-me-1 h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[13rem]">
            <DropdownMenuItem className={menuItem} onSelect={() => setConfirm('remove')}><UserMinus aria-hidden className="h-4 w-4" />{t('social.list.remove')}</DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onSelect={() => setConfirm('block')}><Ban aria-hidden className="h-4 w-4" />{t('social.list.block')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {shareButton}
      </>
    )
  } else if (relation === 'incoming') {
    actions = (
      <>
        <Button className={big} onClick={() => void answer(true)} disabled={busy}><Check aria-hidden className="h-[18px] w-[18px]" />{t('social.inbox.accept')}</Button>
        <Button variant="ghost" className={cn(big, 'ring-1 ring-inset ring-white/[0.14]')} onClick={() => void answer(false)} disabled={busy}><X aria-hidden className="h-[18px] w-[18px]" />{t('social.inbox.decline')}</Button>
        {shareButton}
        {blockMenu}
      </>
    )
  } else if (relation === 'outgoing') {
    actions = (
      <>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            {/* Asked a moment ago: the request's id comes with the refreshed page. */}
            <Button variant="secondary" className={cn(big, 'data-[state=open]:bg-white/[0.16]')} disabled={busy || !requestId}>
              <Clock3 aria-hidden className="h-[18px] w-[18px]" />{t('social.list.requested')}<ChevronDown aria-hidden className="-me-1 h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[13rem]">
            <DropdownMenuItem className={menuItem} onSelect={() => void cancelRequest()}><X aria-hidden className="h-4 w-4" />{t('social.page.cancelRequest')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {shareButton}
        {blockMenu}
      </>
    )
  } else {
    actions = (
      <>
        {!requestsOff && !invitePending && <Button className={big} onClick={() => void addFriend()} disabled={busy}><UserPlus aria-hidden className="h-[18px] w-[18px]" />{t('social.add.addFriend')}</Button>}
        {shareButton}
        {viewer === 'member' && blockMenu}
      </>
    )
  }

  return (
    <header className={cn('page-x relative isolate', belowBanner ? 'pt-10 sm:pt-12' : 'page-top')}>
      {/* Their colour, as a soft light behind the face. */}
      <div aria-hidden className="pointer-events-none absolute -top-24 start-0 -z-10 h-80 w-80 rounded-full opacity-30 blur-[90px] sm:start-10" style={{ background: person.color }} />
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-9">
        <span className="shrink-0 animate-focus-in">
          <UserAvatar person={person} size={96} className="ring-4 ring-black/40 md:hidden" />
          <UserAvatar person={person} size={128} className="hidden ring-4 ring-black/40 md:inline-flex" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 dir="auto" className="break-words font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white">{person.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
            <bdi dir="ltr" className="text-white/55">@{person.handle}</bdi>
            {friendsSince && relation === 'friends' && <span className="text-white/70">{t('social.page.friendsSince', { date: friendsSince })}</span>}
          </p>
          {bio && <p dir="auto" className="mt-4 max-w-[60ch] whitespace-pre-line text-pretty text-[15px] leading-relaxed text-white/75">{bio}</p>}
          {relation === 'incoming' && !isOwner && (
            <p className="mt-4 text-[14px] text-white/70">{t('social.inbox.friendRequest', { name: person.name })}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">{actions}</div>
        </div>
      </div>
      {badges && <div className="mt-10">{badges}</div>}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        title={t(confirm === 'block' ? 'social.list.blockTitle' : 'social.list.removeTitle', { name: person.name })}
        text={t(confirm === 'block' ? 'social.list.blockText' : 'social.list.removeText')}
        confirm={confirm === 'block' ? t('social.list.block') : t('social.list.removeConfirm')}
        onConfirm={() => void removeOrBlock()}
        busy={busy}
      />

      {/* Asking without a page yet: make one here, then the request goes out. */}
      <Dialog open={setup} onOpenChange={setSetup}>
        <DialogContent className="max-h-[calc(100dvh-48px)] max-w-[520px] overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="sr-only">{t('social.setup.title')}</DialogTitle>
          <DialogDescription className="pe-10 text-[14px] text-white/70">{t('social.page.setupToAdd')}</DialogDescription>
          <ProfileSetupCard variant="inline" onCreated={() => { setSetup(false); void addFriendAfterSetup() }} />
        </DialogContent>
      </Dialog>
    </header>
  )

  async function addFriendAfterSetup() {
    setBusy(true)
    try {
      const response = await fetch('/api/social/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: person.handle }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) return fail(body)
      haptic(10)
      setRelation(body.status === 'friends' ? 'friends' : 'outgoing')
      toast({ title: body.status === 'friends' ? t('social.list.acceptedToast', { name: person.name }) : t('social.add.sent') })
    } catch {
      fail()
    } finally {
      setBusy(false)
      router.refresh()
    }
  }
}
