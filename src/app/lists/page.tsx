"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ListVideo, Plus } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { Skeleton } from '@/src/components/ui/skeleton'
import { EmptyState } from '@/src/components/MediaGrid'
import { useT } from '@/src/components/I18nProvider'
import LibraryHeader from '@/src/components/library/LibraryHeader'
import SignInInvite from '@/src/components/library/SignInInvite'
import ListCover from '@/src/components/library/ListCover'
import ListDetailsFields from '@/src/components/library/ListDetailsForm'
import { toast } from '@/src/hooks/use-toast'
import type { PublicList } from '@/src/lib/lists-db'

const LISTS_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-x-4 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] sm:gap-x-5 sm:gap-y-9'

/** "My lists": the signed-in user's shareable lists, and a dialog to start a new one. */
export default function MyListsPage() {
  const { status } = useSession()
  const router = useRouter()
  const t = useT()
  const [lists, setLists] = useState<PublicList[] | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/lists')
      .then((res) => (res.ok ? res.json() : { lists: [] }))
      .then((data) => setLists(data.lists ?? []))
      .catch(() => setLists([]))
  }, [status])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('library.createFailed'))
      router.push(`/lists/${data.list.slug}`)
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message })
      setCreating(false)
    }
  }

  const signedOut = status === 'unauthenticated'
  const count = lists?.length ?? 0
  const newList = (
    <Button onClick={() => setOpen(true)}>
      <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
      {t('library.newList')}
    </Button>
  )

  return (
    <div className="page-top pb-10">
      <LibraryHeader
        title={t('library.listsTitle')}
        subtitle={t('library.listsSubtitle')}
        actions={status === 'authenticated' ? newList : null}
      />

      <div className="mt-8 sm:mt-10">
        {signedOut ? (
          <SignInInvite icon={ListVideo} />
        ) : lists === null ? (
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
        ) : count === 0 ? (
          <div className="page-x">
            <EmptyState icon={<ListVideo aria-hidden className="h-6 w-6" />} title={t('library.noLists')}>
              <p>{t('library.noListsHint')}</p>
              <Button className="mt-5" onClick={() => setOpen(true)}>
                <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {t('library.createFirstList')}
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="page-x">
            <ul className={LISTS_GRID}>
              {lists.map((list) => (
                <li key={list.slug}>
                  <Link href={`/lists/${list.slug}`} className="group/cover block select-none rounded-tile outline-none [-webkit-touch-callout:none]">
                    <div className="rounded-tile transition-[transform,box-shadow] duration-300 ease-out group-hover/cover:-translate-y-1 group-hover/cover:shadow-[0_22px_44px_-18px_rgb(0_0_0/0.9)] group-active/cover:scale-[0.98] group-focus-visible/cover:ring-2 group-focus-visible/cover:ring-red-500">
                      <ListCover posters={list.items.map((item) => item.poster_path)} emptyLabel={t('library.emptyList')} />
                    </div>
                    <p className="mt-3 truncate px-0.5 text-[15px] font-semibold text-white/90 transition-colors group-hover/cover:text-white"><bdi>{list.title}</bdi></p>
                    <p className="mt-0.5 px-0.5 text-[13px] text-white/50">
                      {list.items.length === 1 ? t('library.countOne') : t('library.count', { count: list.items.length })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
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
