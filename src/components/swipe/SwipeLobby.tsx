"use client"
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FaHeart, FaXmark } from 'react-icons/fa6'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { getSavedName, saveCredentials, saveName } from './storage'

const input = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-zinc-700 dark:bg-[#1a161f] dark:text-white'
const card = 'rounded-2xl border border-gray-200 p-5 dark:border-zinc-800'

/** /swipe: explains the game, creates a room or joins one by code. */
export default function SwipeLobby({ genres }: { genres: { id: number, name: string }[] }) {
  const t = useT()
  const router = useRouter()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'movie' | 'tv' | 'both'>('movie')
  const [genre, setGenre] = useState('')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setName(getSavedName()), [])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) return setError(t('swipe.nameRequired'))
    setCreating(true)
    try {
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kind, genre: genre ? Number(genre) : null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(response.status === 429 ? t('auth.tooManyAttempts') : t('swipe.createFailed'))
        return
      }
      saveName(name.trim())
      saveCredentials(data.code, data.participant)
      router.push(`/swipe/${data.code}`)
    } catch {
      setError(t('swipe.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const join = (event: React.FormEvent) => {
    event.preventDefault()
    const clean = code.trim().toUpperCase()
    if (/^[A-Z2-9]{6}$/.test(clean)) router.push(`/swipe/${clean}`)
    else setError(t('swipe.badCode'))
  }

  return (
    <div className="w-full max-w-3xl px-4 sm:px-6 pb-10 space-y-6">
      <header className="text-center space-y-3 pt-4">
        <div className="flex items-center justify-center gap-3 text-4xl" aria-hidden>
          <FaXmark className="text-gray-400" /><span>🍿</span><FaHeart className="text-red-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold">{t('swipe.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">{t('swipe.subtitle')}</p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-3 text-sm">
        {(['swipe.step1', 'swipe.step2', 'swipe.step3'] as const).map((key, index) => (
          <li key={key} className={`${card} flex gap-3`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white font-bold">{index + 1}</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ol>

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-500">{error}</p>}

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <form onSubmit={create} className={`${card} space-y-4`}>
          <h2 className="text-lg font-semibold">{t('swipe.createTitle')}</h2>
          <label className="block space-y-1 text-sm">
            <span>{t('swipe.yourName')}</span>
            <input className={input} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
          </label>
          <fieldset className="space-y-1 text-sm">
            <legend>{t('swipe.what')}</legend>
            <div className="flex gap-2">
              {(['movie', 'tv', 'both'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                  className={`flex-1 rounded-xl px-3 py-2 font-medium transition-colors ${kind === value ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}
                >
                  {t(value === 'movie' ? 'common.movies' : value === 'tv' ? 'common.tvShows' : 'swipe.both')}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-1 text-sm">
            <span>{t('swipe.genre')}</span>
            <select className={input} value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">{t('swipe.anyGenre')}</option>
              {genres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <Button type="submit" disabled={creating} className="w-full bg-red-500 text-white hover:bg-red-400">
            {creating ? t('swipe.creating') : t('swipe.create')}
          </Button>
        </form>

        <form onSubmit={join} className={`${card} space-y-4 self-start`}>
          <h2 className="text-lg font-semibold">{t('swipe.joinTitle')}</h2>
          <label className="block space-y-1 text-sm">
            <span>{t('swipe.roomCode')}</span>
            <input
              className={`${input} text-center text-2xl font-bold tracking-[0.3em] uppercase`}
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoComplete="off"
              dir="ltr"
            />
          </label>
          <Button type="submit" variant="outline" className="w-full">{t('swipe.join')}</Button>
        </form>
      </div>
    </div>
  )
}
