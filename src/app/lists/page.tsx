"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { MdPlaylistAdd } from 'react-icons/md'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import type { PublicList } from '@/src/lib/lists-db'
import TmdbImage from '@/src/components/TmdbImage'

/** 2x2 poster collage used as a list's cover. */
function Collage({ list }: { list: PublicList }) {
  const posters = list.items.map((item) => item.poster_path).filter(Boolean).slice(0, 4) as string[]
  return (
    <div className="grid grid-cols-2 aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-800">
      {posters.length === 0
        ? <div className="col-span-2 flex items-center justify-center text-gray-500 text-sm">Empty list</div>
        : posters.map((path) => (
          <div key={path} className="relative h-full w-full">
            <TmdbImage kind="poster" path={path} alt="" fill sizes="(min-width: 640px) 160px, 25vw" className="object-cover" />
          </div>
        ))}
    </div>
  )
}

export default function MyListsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [lists, setLists] = useState<PublicList[] | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status !== 'authenticated') return
    fetch('/api/lists')
      .then((res) => (res.ok ? res.json() : { lists: [] }))
      .then((data) => setLists(data.lists ?? []))
      .catch(() => setLists([]))
  }, [status, router])

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
      if (!res.ok) throw new Error(data.error || 'Failed to create the list')
      router.push(`/lists/${data.list.slug}`)
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
      setCreating(false)
    }
  }

  return (
    <div className="w-full max-w-[1800px] px-4 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold">My Lists</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Make a list (&ldquo;My top 10 Tunisian series&rdquo;, &ldquo;Ramadan watchlist&rdquo;…) and share it with a link.</p>
      </div>

      <form onSubmit={create} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-5 flex flex-col gap-3 max-w-2xl">
        <div className="flex items-center gap-2 font-semibold text-white"><MdPlaylistAdd className="text-xl text-red-500" /> New list</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="List title, e.g. My top 10 Tunisian series"
          aria-label="List title"
          className="h-10 rounded-xl bg-zinc-800 px-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Description (optional)"
          aria-label="List description"
          className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        />
        <div>
          <Button type="submit" disabled={creating || !title.trim()} className="bg-red-500 text-white hover:bg-red-400">
            {creating ? 'Creating…' : 'Create list'}
          </Button>
        </div>
      </form>

      {lists === null ? (
        <p className="text-gray-400">Loading your lists…</p>
      ) : lists.length === 0 ? (
        <p className="text-gray-400">No lists yet. Create your first one above.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
          {lists.map((list) => (
            <Link key={list.slug} href={`/lists/${list.slug}`} className="group">
              <div className="transition-transform group-hover:scale-[1.03]"><Collage list={list} /></div>
              <p className="mt-2 font-semibold truncate group-hover:text-red-500">{list.title}</p>
              <p className="text-xs text-gray-500">{list.items.length} title{list.items.length === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
