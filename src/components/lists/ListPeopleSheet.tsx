"use client"
// Who is in a list, and what each person may do about it: the owner hands the list over, takes
// someone out, decides who can see it and turns the invitation link off; everyone can mute the
// list's notifications; editors can leave. Every irreversible step asks first (Cancel focused).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Link2Off, LogOut, UserMinus } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { UserAvatar } from '@/src/components/social/Avatar'
import VisibilitySelect from '@/src/components/social/VisibilitySelect'
import { Button } from '@/src/components/ui/button'
import { Switch } from '@/src/components/ui/switch'
import { toast } from '@/src/hooks/use-toast'
import { formatDate } from '@/src/lib/i18n/format'
import { richT } from '@/src/lib/i18n/rich'
import type { ListCollaborators, ListVisibility, SharedListMember, SharedListView } from '@/src/lib/shared-lists/types'
import { ConfirmDialog, ListSheet } from './ListSheet'
import { listErrorText, listFetch } from './list-client'
import { orderedMembers } from './PeopleNames'

type Confirm = { kind: 'remove' | 'owner' | 'leave'; member: SharedListMember } | null

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2.5 text-[13px] font-medium text-white/70">{children}</h3>
}

export default function ListPeopleSheet({ open, onOpenChange, list, onChanged, onVisibility }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  list: SharedListView
  /** Someone joined, left or became the owner: read the list again. */
  onChanged: () => void
  onVisibility: (visibility: ListVisibility) => Promise<boolean>
}) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [data, setData] = useState<ListCollaborators | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const endpoint = `/api/lists/${encodeURIComponent(list.slug)}/collaborators`
  const loads = useRef(0)

  const load = useCallback(async () => {
    const id = ++loads.current
    try {
      const next = await listFetch<ListCollaborators>(endpoint)
      if (id === loads.current && next) {
        setData(next)
        setFailed(false)
      }
    } catch {
      if (id === loads.current) setFailed(true)
    }
  }, [endpoint])

  // Fresh every time the sheet opens (and whenever the list changes while it is open).
  useEffect(() => {
    if (open) load()
  }, [open, load, list.version])

  const owner = list.role === 'owner'
  const members = orderedMembers(data?.members ?? list.members)
  const people = data?.people ?? list.people
  const me = members.find((member) => member.you)
  const muted = data?.members.find((member) => member.you)?.muted ?? me?.muted ?? false
  const solo = members.length <= 1

  const act = async (run: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true)
    try {
      await run()
      toast({ title: success, duration: 2500 })
      setConfirm(null)
      after?.()
      await load()
      onChanged()
    } catch (error) {
      toast({ variant: 'destructive', title: listErrorText(t, error) })
    } finally {
      setBusy(false)
    }
  }

  const confirmed = () => {
    if (!confirm) return
    const name = people[confirm.member.id]?.name ?? ''
    if (confirm.kind === 'owner') {
      act(() => listFetch(endpoint, { method: 'PATCH', body: { member: confirm.member.id, role: 'owner' } }), t('sharedLists.sheet.ownerChanged', { name }))
    } else if (confirm.kind === 'remove') {
      act(() => listFetch(`${endpoint}?member=${encodeURIComponent(confirm.member.id)}`, { method: 'DELETE' }), t('sharedLists.sheet.removed', { name }))
    } else {
      act(() => listFetch(`${endpoint}?member=${encodeURIComponent(confirm.member.id)}`, { method: 'DELETE' }), t('sharedLists.sheet.left'), () => {
        onOpenChange(false)
        router.push('/lists')
      })
    }
  }

  const setMuted = async (value: boolean) => {
    setData((current) => current && { ...current, members: current.members.map((member) => (member.you ? { ...member, muted: value } : member)) })
    try {
      await listFetch(endpoint, { method: 'PATCH', body: { muted: value } })
    } catch (error) {
      setData((current) => current && { ...current, members: current.members.map((member) => (member.you ? { ...member, muted: !value } : member)) })
      toast({ variant: 'destructive', title: listErrorText(t, error) })
    }
  }

  const turnOffLink = () => act(() => listFetch(endpoint, { method: 'DELETE', body: { invite: 'link' } }), t('sharedLists.sheet.linkTurnedOff'))

  const invite = data?.invite
  const confirmName = confirm ? people[confirm.member.id]?.name ?? '' : ''

  return (
    <>
      <ListSheet open={open} onOpenChange={onOpenChange} title={t('sharedLists.people.label')}>
        <div className="space-y-7">
          <section aria-label={t('sharedLists.people.label')}>
            <ul className="-mx-2 space-y-0.5">
              {members.map((member) => {
                const person = people[member.id]
                const canManage = owner && member.role === 'editor' && !member.you
                return (
                  <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-2 py-2">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      {person && <UserAvatar person={person} size={40} />}
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <bdi className="truncate text-[15px] font-medium text-white">{person?.name ?? '?'}</bdi>
                          {member.you && <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[12px] font-medium text-white/70">{t('sharedLists.people.you')}</span>}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/55">
                          {member.role === 'owner' && <Crown aria-hidden className="h-3.5 w-3.5 text-star" />}
                          {t(member.role === 'owner' ? 'sharedLists.sheet.owner' : 'sharedLists.sheet.editor')}
                        </span>
                      </span>
                    </span>
                    {canManage && (
                      <span className="flex shrink-0 gap-1 max-[380px]:w-full max-[380px]:ps-[52px]">
                        <Button size="sm" variant="ghost" className="h-11 px-3.5 text-[13.5px]" aria-label={t('sharedLists.sheet.makeOwnerAria', { name: person?.name ?? '' })} onClick={() => setConfirm({ kind: 'owner', member })}>
                          {t('sharedLists.sheet.makeOwner')}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-11 px-3.5 text-[13.5px] text-red-300 hover:bg-red-600/15 hover:text-red-200" aria-label={t('sharedLists.sheet.removeAria', { name: person?.name ?? '' })} onClick={() => setConfirm({ kind: 'remove', member })}>
                          {t('sharedLists.sheet.remove')}
                        </Button>
                      </span>
                    )}
                  </li>
                )
              })}
              {owner && data?.pending.map((entry, index) => (
                <li key={`pending-${index}`} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <UserAvatar person={entry.person} size={40} className="opacity-60" />
                  <span className="min-w-0">
                    <bdi className="block truncate text-[15px] font-medium text-white/80">{entry.person.name}</bdi>
                    <span className="mt-0.5 block text-[13px] text-white/55">{t('sharedLists.sheet.invited')}</span>
                  </span>
                </li>
              ))}
            </ul>
            {failed && !data && <p role="alert" className="mt-2 text-[13px] text-red-400">{t('sharedLists.sheet.loadFailed')}</p>}
          </section>

          {owner && (
            <section>
              <Label>{t('sharedLists.sheet.whoCanSee')}</Label>
              <VisibilitySelect
                value={list.visibility}
                onChange={(value) => { onVisibility(value) }}
                label={t('sharedLists.sheet.whoCanSee')}
                context="list"
                solo={solo}
              />
            </section>
          )}

          {owner && data && (
            <section>
              <Label>{t('sharedLists.sheet.link')}</Label>
              {invite?.active ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
                  <p className="flex flex-col text-[13.5px] text-white/70">
                    <span className="tabular-nums">{t('sharedLists.sheet.linkUses', { uses: invite.uses, max: invite.maxUses })}</span>
                    {invite.expiresAt && <span>{t('sharedLists.sheet.linkUntil', { date: formatDate(invite.expiresAt, locale, { day: 'numeric', month: 'long' }) })}</span>}
                  </p>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={turnOffLink} className="h-11 px-4 ring-1 ring-inset ring-white/[0.12]">
                    <Link2Off aria-hidden className="h-4 w-4" />{t('sharedLists.sheet.turnOffLink')}
                  </Button>
                </div>
              ) : (
                <p className="text-[13.5px] leading-relaxed text-white/60">
                  {invite && invite.maxUses > 0 && invite.uses >= invite.maxUses ? t('sharedLists.sheet.linkUsedUp') : t('sharedLists.sheet.linkOff')}
                </p>
              )}
            </section>
          )}

          {me && !solo && (
            <section>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-4 py-2.5 ring-1 ring-inset ring-white/[0.06]">
                <span className="min-w-0">
                  <span id="list-mute-label" className="block text-[15px] font-medium text-white">{t('sharedLists.sheet.mute')}</span>
                  <span className="block text-[13px] text-white/55">{t('sharedLists.sheet.muteHint')}</span>
                </span>
                <Switch checked={muted} onCheckedChange={setMuted} aria-labelledby="list-mute-label" />
              </div>
              {me.role === 'editor' && (
                <Button variant="ghost" className="mt-3 h-11 w-full justify-start gap-2.5 px-4 text-red-300 hover:bg-red-600/15 hover:text-red-200" onClick={() => setConfirm({ kind: 'leave', member: me })}>
                  <LogOut aria-hidden className="h-4 w-4 rtl:-scale-x-100" />{t('sharedLists.sheet.leave')}
                </Button>
              )}
            </section>
          )}
        </div>
      </ListSheet>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(next) => { if (!next) setConfirm(null) }}
        busy={busy}
        icon={confirm?.kind === 'owner' ? <Crown className="h-5 w-5" /> : confirm?.kind === 'leave' ? <LogOut className="h-5 w-5 rtl:-scale-x-100" /> : <UserMinus className="h-5 w-5" />}
        title={confirm?.kind === 'owner'
          ? richT(t, 'sharedLists.sheet.ownerTitle', { name: confirmName })
          : confirm?.kind === 'leave' ? richT(t, 'sharedLists.sheet.leaveTitle', { list: list.title }) : richT(t, 'sharedLists.sheet.removeTitle', { name: confirmName })}
        description={confirm?.kind === 'owner'
          ? t('sharedLists.sheet.ownerDesc')
          : confirm?.kind === 'leave' ? t('sharedLists.sheet.leaveDesc') : t('sharedLists.sheet.removeDesc')}
        confirmLabel={confirm?.kind === 'owner' ? t('sharedLists.sheet.makeOwner') : confirm?.kind === 'leave' ? t('sharedLists.sheet.leave') : t('sharedLists.sheet.remove')}
        onConfirm={confirmed}
      />
    </>
  )
}
