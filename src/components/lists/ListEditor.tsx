"use client"
import React, { useEffect, useMemo, useState } from 'react'
import TmdbImage from '@/src/components/TmdbImage'
import { useRouter } from 'next/navigation'
import { IoClose } from 'react-icons/io5'
import { FaChevronLeft, FaChevronRight, FaPlus, FaCheck } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import PosterCard from '@/src/components/PosterCard'
import { toast } from '@/src/hooks/use-toast'
import { searchMovies } from '@/src/app/search/actions'
import { getFavorites, getWatchHistory } from '@/src/lib/user-content'
import type { PublicList } from '@/src/lib/lists-db'

type Item = PublicList['items'][number]
type Candidate = { id: string, media_type: 'movie' | 'tv', title: string, poster_path: string | null, year?: string }

const keyOf = (item: { media_type: string, id: string | number }) => `${item.media_type}-${item.id}`
const routeOf = (item: Item) => `/${item.media_type}/${item.id}`

/** Owner view of a list: edit details, add/remove/reorder titles, delete. */
export default function ListEditor({ initial }: { initial: PublicList }) {
  const router = useRouter()
  const [list, setList] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<Candidate[]>([])

  const inList = useMemo(() => new Set(list.items.map(keyOf)), [list.items])

  const patch = async (body: object, success?: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/lists/${list.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update the list')
      setList(data.list)
      if (success) toast({ title: success, duration: 2000 })
      router.refresh() // keep the server-rendered parts (share card, counts) in sync
      return true
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message })
      return false
    } finally {
      setSaving(false)
    }
  }

  const add = (candidate: Candidate) => patch({ add: candidate }, `Added ${candidate.title}`)
  const remove = (item: Item) => patch({ remove: { id: item.id, media_type: item.media_type } })
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= list.items.length) return
    const order = list.items.map(keyOf)
    ;[order[index], order[target]] = [order[target], order[index]]
    patch({ order })
  }

  // Search TMDB (debounced) for titles to add.
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    let cancelled = false
    setSearching(true)
    const timeout = setTimeout(async () => {
      try {
        const data: any = await searchMovies(q, false, 1)
        if (cancelled) return
        setResults((data.results ?? [])
          .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
          .slice(0, 8)
          .map((item: any) => ({
            id: String(item.id),
            media_type: item.media_type,
            title: item.title || item.name,
            poster_path: item.poster_path ?? null,
            year: (item.release_date || item.first_air_date || '').slice(0, 4),
          })))
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [query])

  // One-tap suggestions from the user's favorites and watch history.
  useEffect(() => {
    Promise.all([getFavorites(), getWatchHistory()]).then(([favorites, history]) => {
      const seen = new Set<string>()
      const merged: Candidate[] = []
      for (const item of [...favorites, ...history]) {
        const key = keyOf(item)
        if (seen.has(key) || !item.poster_path || (item.media_type !== 'movie' && item.media_type !== 'tv')) continue
        seen.add(key)
        merged.push({ id: String(item.id), media_type: item.media_type, title: item.title, poster_path: item.poster_path })
      }
      setSuggestions(merged.slice(0, 18))
    })
  }, [])

  const saveDetails = async () => {
    if (await patch({ title, description }, 'List updated')) setEditing(false)
  }

  const deleteList = async () => {
    if (!window.confirm(`Delete "${list.title}"? This can't be undone.`)) return
    const res = await fetch(`/api/lists/${list.slug}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'List deleted', duration: 2000 })
      router.push('/lists')
    } else {
      toast({ variant: 'destructive', title: 'Error', description: "Couldn't delete the list" })
    }
  }

  const freshSuggestions = suggestions.filter((item) => !inList.has(keyOf(item)))

  return (
    <div className="space-y-8">
      {/* Details */}
      <section className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 sm:p-5 max-w-3xl">
        {editing ? (
          <div className="flex flex-col gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="List title"
              className="h-10 rounded-xl bg-zinc-800 px-3 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} aria-label="List description"
              className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500" />
            <div className="flex gap-2">
              <Button onClick={saveDetails} disabled={saving || !title.trim()} className="bg-red-500 text-white hover:bg-red-400">Save</Button>
              <Button variant="outline" onClick={() => { setEditing(false); setTitle(list.title); setDescription(list.description) }} className="bg-transparent text-white border-zinc-700">Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-400">You own this list. Only people with the link can see it.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)} className="bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:text-white">Edit details</Button>
              <Button variant="outline" onClick={deleteList} className="bg-transparent text-red-400 border-red-500/40 hover:bg-red-500/10 hover:text-red-300">Delete list</Button>
            </div>
          </div>
        )}
      </section>

      {/* Add titles */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Add titles</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies and TV shows to add…"
          aria-label="Search titles to add"
          className="h-11 w-full max-w-xl rounded-xl bg-zinc-800 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        />
        {query.trim() && (
          <ul className="max-w-xl divide-y divide-zinc-800 rounded-xl bg-zinc-900 border border-zinc-800">
            {searching && results.length === 0 && <li className="p-3 text-sm text-gray-400">Searching…</li>}
            {!searching && results.length === 0 && <li className="p-3 text-sm text-gray-400">No results</li>}
            {results.map((item) => {
              const added = inList.has(keyOf(item))
              return (
                <li key={keyOf(item)} className="flex items-center gap-3 p-2">
                  <span className="relative block h-14 w-10 shrink-0 rounded overflow-hidden bg-zinc-800">
                    <TmdbImage kind="poster" path={item.poster_path} alt="" fill sizes="40px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.media_type === 'tv' ? 'TV Show' : 'Movie'}{item.year ? ` · ${item.year}` : ''}</p>
                  </div>
                  <button
                    type="button"
                    disabled={added || saving}
                    onClick={() => add(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-red-500 text-white hover:bg-red-400 disabled:bg-zinc-700 disabled:text-gray-400"
                  >
                    {added ? <><FaCheck /> Added</> : <><FaPlus /> Add</>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {freshSuggestions.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-gray-400">From your favorites & history: tap to add</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {freshSuggestions.map((item) => (
                <button
                  key={keyOf(item)}
                  type="button"
                  disabled={saving}
                  onClick={() => add(item)}
                  title={`Add ${item.title}`}
                  className="group relative shrink-0 w-[72px] overflow-hidden rounded-lg"
                >
                  <span className="relative block aspect-[2/3] w-full bg-zinc-800">
                    <TmdbImage kind="poster" path={item.poster_path} alt={item.title} fill sizes="72px" className="object-cover" />
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 text-white"><FaPlus /></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Items */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">{list.items.length} title{list.items.length === 1 ? '' : 's'}</h2>
        {list.items.length === 0 ? (
          <p className="text-gray-400">This list is empty. Search above to add your first title.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(167px,1fr))] gap-4">
            {list.items.map((item, index) => (
              <div key={keyOf(item)} className="group relative">
                <PosterCard posterImg={item.poster_path} title={item.title} mediaType={item.media_type} link={routeOf(item)} actions={false} />
                <span className="pointer-events-none absolute start-1.5 top-1.5 z-30 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">#{index + 1}</span>
                <button type="button" onClick={() => remove(item)} disabled={saving} aria-label={`Remove ${item.title}`} title="Remove"
                  className="absolute end-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100">
                  <IoClose />
                </button>
                <div className="absolute inset-x-1.5 bottom-12 z-30 flex justify-between sm:opacity-0 sm:group-hover:opacity-100">
                  <button type="button" onClick={() => move(index, -1)} disabled={saving || index === 0} aria-label="Move earlier" title="Move earlier"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500 disabled:opacity-30"><FaChevronLeft className="text-xs" /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={saving || index === list.items.length - 1} aria-label="Move later" title="Move later"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500 disabled:opacity-30"><FaChevronRight className="text-xs" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
