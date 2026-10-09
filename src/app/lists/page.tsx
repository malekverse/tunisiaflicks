"use client"
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ListVideo, Plus, UsersRound } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Chip, ChipGroup } from '@/src/components/ui/chip'
import { EmptyState } from '@/src/components/MediaGrid'
import { useT } from '@/src/components/I18nProvider'
import LibraryHeader from '@/src/components/library/LibraryHeader'
import SignInInvite from '@/src/components/library/SignInInvite'
import ListDetailsFields from '@/src/components/library/ListDetailsForm'
import VisibilitySelect from '@/src/components/social/VisibilitySelect'
import InvitationsStrip from '@/src/components/lists/InvitationsStrip'
import ListTile, { LISTS_GRID } from '@/src/components/lists/ListTile'
import { listErrorText, listFetch } from '@/src/components/lists/list-client'
import { useMyLists } from '@/src/hooks/use-my-lists'
import { toast } from '@/src/hooks/use-toast'
import type { ListVisibility, MyListSummary, SharedListView } from '@/src/lib/shared-lists/types'

type Filter = 'all' | 'yours' | 'shared'

function Grid({ lists }: { lists: MyListSummary[] }) {
  return (
    <ul className={LISTS_GRID}>
      {lists.map((list) => (
        <li key={list.slug}>
          <ListTile {...list} />
        </li>
      ))}
    </ul>
  )
}

function SectionTitle({ id, children, count }: { id: string; children: React.ReactNode; count: number }) {
  return (
    <h2 id={id} className="mb-5 flex items-baseline gap-3 font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">
      {children}
      <span className="font-sans text-[14px] font-normal tabular-nums text-white/50">{count}</span>
    </h2>
  )
}

/**
 * "My lists": the lists you made and the ones friends let you into, invitations waiting for an
 * answer, and a dialog to start a new list (private until you open it up).
 */
export default function MyListsPage() {
  const { status } = useSession()
  const router = useRouter()
  const t = useT()
  const mine = useMyLists({ refreshOnFocus: true })
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<ListVisibility>('private')
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      const data = await listFetch<{ list: SharedListView }>('/api/lists', { method: 'POST', body: { title, description, ...(mine.data?.kids ? {} : { visibility }) } })
      router.push(`/lists/${data!.list.slug}`)
    } catch (error) {
      toast({ variant: 'destructive', title: t('library.createFailed'), description: listErrorText(t, error) })
      setCreating(false)
    }
  }

  const signedOut = status === 'unauthenticated' || mine.status === 'guest'
  const data = mine.data
  const kids = !!data?.kids
  const yours = data?.lists.filter((list) => list.role === 'owner') ?? []
  const sharedWithYou = data?.lists.filter((list) => list.role === 'editor') ?? []
  const invitations = kids ? [] : data?.invitations ?? []
  const both = yours.length > 0 && sharedWithYou.length > 0
  const total = (data?.lists.length ?? 0) + invitations.length
  // A draft started and cancelled is still there when the dialog opens again.
  const startDialog = () => setOpen(true)
  const newList = (
    <Button onClick={startDialog}>
      <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
      {t('library.newList')}
    </Button>
  )

  return (
    <div className="page-top pb-10">
      <LibraryHeader
        title={t('library.listsTitle')}
        subtitle={t('library.listsSubtitle')}
        actions={status === 'authenticated' && !signedOut ? newList : null}
        toolbar={both ? (
          <ChipGroup label={t('sharedLists.filter.label')} mode="single">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>{t('common.all')}</Chip>
            <Chip active={filter === 'yours'} onClick={() => setFilter('yours')} count={yours.length}>{t('sharedLists.yours')}</Chip>
            <Chip active={filter === 'shared'} onClick={() => setFilter('shared')} count={sharedWithYou.length} icon={UsersRound}>{t('sharedLists.sharedWithYou')}</Chip>
          </ChipGroup>
        ) : null}
      />

      <div className="mt-8 sm:mt-10">
        {signedOut ? (
          <SignInInvite icon={ListVideo} />
        ) : !data && mine.status === 'error' ? (
          <div className="page-x">
            <EmptyState icon={<ListVideo aria-hidden className="h-6 w-6" />} title={t('common.listFailed')} action={<Button variant="secondary" onClick={() => mine.reload()}>{t('sharedLists.add.retry')}</Button>} />
          </div>
        ) : !data ? (
          <div className="page-x">
            <p className="sr-only" role="status">{t('library.loadingLists')}</p>
            <div className={LISTS_GRID}>
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index}>
                  <Skeleton className="aspect-[4/3] w-full rounded-tile" />
                  <Skeleton className="mt-3 h-4 w-2/3 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-1/4 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="page-x">
            <EmptyState icon={<ListVideo aria-hidden className="h-6 w-6" />} title={t('library.noLists')}>
              <p>{t('library.noListsHint')}</p>
              <Button className="mt-5" onClick={startDialog}>
                <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {t('library.createFirstList')}
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="space-y-10 sm:space-y-12">
            <InvitationsStrip
              invitations={invitations}
              onJoined={() => mine.reload(true)}
              onGone={(slug) => mine.update((current) => ({ ...current, invitations: current.invitations.filter((invitation) => invitation.slug !== slug) }))}
            />
            {sharedWithYou.length === 0 ? (
              yours.length > 0 && <div className="page-x"><Grid lists={yours} /></div>
            ) : (
              <>
                {filter !== 'shared' && (
                  <section aria-labelledby="lists-yours" className="page-x">
                    <SectionTitle id="lists-yours" count={yours.length}>{t('sharedLists.yours')}</SectionTitle>
                    {yours.length > 0 ? <Grid lists={yours} /> : (
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07]">
                        <p className="text-[14px] text-white/70">{t('library.noListsHint')}</p>
                        <Button onClick={startDialog}><Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />{t('library.createFirstList')}</Button>
                      </div>
                    )}
                  </section>
                )}
                {filter !== 'yours' && (
                  <section aria-labelledby="lists-shared" className="page-x">
                    <SectionTitle id="lists-shared" count={sharedWithYou.length}>{t('sharedLists.sharedWithYou')}</SectionTitle>
                    <Grid lists={sharedWithYou} />
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(next) => !creating && setOpen(next)}>
        <DialogContent className="max-w-md">
          <form onSubmit={create} className="space-y-6">
            <DialogHeader>
              <span aria-hidden className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.07] ring-1 ring-inset ring-white/10 max-sm:mx-auto">
                <ListVideo className="h-6 w-6 text-white/85" strokeWidth={1.8} />
              </span>
              <DialogTitle className="font-display text-2xl font-bold">{t('library.newList')}</DialogTitle>
              <DialogDescription>{t('library.listsSubtitle')}</DialogDescription>
            </DialogHeader>
            <ListDetailsFields title={title} description={description} onTitle={setTitle} onDescription={setDescription} autoFocus />
            {!kids && (
              <div className="space-y-2">
                <p id="new-list-visibility" className="text-[13px] font-medium text-white/70">{t('sharedLists.sheet.whoCanSee')}</p>
                <VisibilitySelect value={visibility} onChange={setVisibility} label={t('sharedLists.sheet.whoCanSee')} context="list" solo />
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" disabled={creating} onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={creating || !title.trim()}>
                {creating ? t('library.creating') : t('library.createList')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
