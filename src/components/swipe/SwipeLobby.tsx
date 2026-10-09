"use client"
import React, { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { m } from 'framer-motion'
import { CalendarPlus, ChevronRight, Popcorn } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { useI18n } from '@/src/components/I18nProvider'
import { useProfiles } from '@/src/hooks/use-profiles'
import { dateLocale } from '@/src/lib/i18n/locales'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import CodeInput from './CodeInput'
import PosterFan from './PosterFan'
import { getSavedName, listRooms, saveCredentials, saveName, type SavedRoom } from './storage'

type Kind = 'movie' | 'tv' | 'both'
const KINDS: Kind[] = ['movie', 'tv', 'both']
const panel = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6'
const fieldLabel = 'text-[13px] font-normal text-white/70'
const errorText = 'text-[13px] text-red-400'

/** /swipe: an invitation to pick tonight's film together. Create a room, or join one by code. */
export default function SwipeLobby({ genres, posters }: { genres: { id: number, name: string }[], posters: string[] }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const ids = useId()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('movie')
  const [genre, setGenre] = useState('')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [rooms, setRooms] = useState<SavedRoom[]>([])
  const { active } = useProfiles()

  useEffect(() => {
    setName(getSavedName())
    setRooms(listRooms())
  }, [])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setCreateError(null)
    if (!name.trim()) return setCreateError(t('swipe.nameRequired'))
    setCreating(true)
    try {
      const response = await fetch('/api/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kind, genre: genre ? Number(genre) : null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setCreateError(response.status === 429 ? t('auth.tooManyAttempts') : t('swipe.createFailed'))
        return
      }
      saveName(name.trim())
      saveCredentials(data.code, data.participant)
      router.push(`/swipe/${data.code}`)
    } catch {
      setCreateError(t('swipe.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const join = (event: React.FormEvent) => {
    event.preventDefault()
    const clean = code.trim().toUpperCase()
    if (/^[A-Z2-9]{6}$/.test(clean)) router.push(`/swipe/${clean}`)
    else setJoinError(t('swipe.badCode'))
  }

  const ago = (savedAt: number) => {
    const minutes = Math.max(1, Math.round((Date.now() - savedAt) / 60000))
    try {
      const format = new Intl.RelativeTimeFormat(dateLocale(locale) ?? 'en', { numeric: 'auto' })
      return minutes < 60 ? format.format(-minutes, 'minute') : format.format(-Math.round(minutes / 60), 'hour')
    } catch {
      return ''
    }
  }

  return (
    <div className="page-top pb-10">
      <div className="page-x">
        <div className="mx-auto grid max-w-[1160px] grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-x-16 lg:gap-y-8">
          <h1 className="col-start-1 row-start-1 self-center text-balance font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] lg:self-end lg:pt-6">
            {t('swipe.title')}
          </h1>

          {/* The fan: next to the title on phones, a big picture beside everything on desktop. */}
          <div className="col-start-2 row-start-1 w-[120px] self-center sm:w-[150px] lg:row-span-4 lg:w-full lg:self-stretch lg:pt-10">
            <div className="lg:sticky lg:top-[calc(var(--topbar)+40px)]">
              <PosterFan posters={posters} sizes="(min-width: 1024px) 300px, 90px" priority className="mx-auto w-full max-w-[520px] lg:w-[92%]" />
            </div>
          </div>

          <p className="col-span-2 row-start-2 -mt-2 max-w-[56ch] text-pretty text-[15px] leading-relaxed text-white/60 lg:col-span-1 lg:-mt-4">
            {t('swipe.subtitle')}
          </p>

          <div className="col-span-2 row-start-3 space-y-4 lg:col-span-1">
            {rooms.length > 0 && (
              <section aria-labelledby={`${ids}-rooms`} className={cn(panel, 'p-2 sm:p-2')}>
                <h2 id={`${ids}-rooms`} className="px-3 pb-1 pt-2 text-[13px] text-white/55">{t('swipe.recentRooms')}</h2>
                <ul>
                  {rooms.map((room) => (
                    <li key={room.code}>
                      <Link
                        href={`/swipe/${room.code}`}
                        className="flex min-h-[52px] items-center gap-3 rounded-[14px] px-3 py-2 transition-colors hover:bg-white/[0.06]"
                      >
                        <span dir="ltr" className="font-display text-xl font-bold tracking-[0.14em] text-white">{room.code}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-white/50">{ago(room.savedAt)}</span>
                        <span className="inline-flex items-center gap-0.5 text-[13px] font-medium text-white/70">
                          {t('swipe.rejoin')}
                          <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <form onSubmit={create} noValidate className={cn(panel, 'space-y-5')}>
              <h2 className="font-display text-[21px] font-bold leading-tight sm:text-[26px]">{t('swipe.createTitle')}</h2>

              <div className="space-y-2">
                <Label htmlFor={`${ids}-name`} className={fieldLabel}>{t('swipe.yourName')}</Label>
                <Input
                  id={`${ids}-name`}
                  value={name}
                  maxLength={24}
                  onChange={(event) => { setName(event.target.value); if (createError) setCreateError(null) }}
                  autoComplete="nickname"
                  enterKeyHint="go"
                  aria-invalid={!!createError && !name.trim()}
                  aria-describedby={createError ? `${ids}-create-error` : undefined}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className={cn(fieldLabel, 'mb-2')}>{t('swipe.what')}</legend>
                <div role="radiogroup" aria-label={t('swipe.what')} className="relative flex rounded-full bg-white/[0.06] p-1">
                  {KINDS.map((value) => {
                    const active = kind === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setKind(value)}
                        className={cn(
                          'relative h-10 flex-1 rounded-full px-3 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500',
                          active ? 'text-black' : 'text-white/70 hover:text-white',
                        )}
                      >
                        {active && <m.span layoutId={`${ids}-kind`} transition={spring.snappy} className="absolute inset-0 rounded-full bg-white" />}
                        <span className="relative">{t(value === 'movie' ? 'common.movies' : value === 'tv' ? 'common.tvShows' : 'swipe.both')}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor={`${ids}-genre`} className={fieldLabel}>{t('swipe.genre')}</Label>
                <Select value={genre || 'any'} onValueChange={(value) => setGenre(value === 'any' ? '' : value)}>
                  <SelectTrigger id={`${ids}-genre`} className="text-[15px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    <SelectItem value="any">{t('swipe.anyGenre')}</SelectItem>
                    {genres.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {createError && <p id={`${ids}-create-error`} role="alert" className={errorText}>{createError}</p>}

              <Button type="submit" size="lg" disabled={creating} className="w-full">
                <Popcorn aria-hidden className="h-5 w-5" strokeWidth={2} />
                {creating ? t('swipe.creating') : t('swipe.create')}
              </Button>
            </form>

            <form onSubmit={join} noValidate className={cn(panel, 'space-y-4')}>
              <div className="space-y-1">
                <h2 className="font-display text-[21px] font-bold leading-tight sm:text-[26px]">{t('swipe.joinTitle')}</h2>
                <Label htmlFor={`${ids}-code`} className={fieldLabel}>{t('swipe.roomCode')}</Label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 sm:flex-1">
                  <CodeInput
                    id={`${ids}-code`}
                    value={code}
                    onChange={(value) => { setCode(value); if (joinError) setJoinError(null) }}
                    invalid={!!joinError}
                    describedBy={joinError ? `${ids}-join-error` : undefined}
                  />
                </div>
                <Button type="submit" size="lg" variant="secondary" className="h-14 shrink-0 sm:px-8">{t('swipe.join')}</Button>
              </div>
              {joinError && <p id={`${ids}-join-error`} role="alert" className={errorText}>{joinError}</p>}
            </form>

            {/* Not tonight? A movie night: a date, friends, and a vote on the film. */}
            {!active?.kids && (
              <Link
                href="/movie-night/new"
                className="group pressable flex min-h-[64px] items-center gap-4 rounded-[22px] px-5 py-4 outline-none ring-1 ring-inset ring-white/[0.07] transition-colors duration-150 hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-red-500 sm:px-6"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><CalendarPlus aria-hidden className="h-5 w-5 text-white/85" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">{t('movieNight.swipe.planLater')}</span>
                  <span className="mt-0.5 block text-[13px] text-white/60">{t('movieNight.swipe.planLaterText')}</span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            )}
          </div>

          <ol className="col-span-2 row-start-4 grid gap-x-6 gap-y-4 pt-2 sm:grid-cols-3 lg:col-span-1">
            {(['swipe.step1', 'swipe.step2', 'swipe.step3'] as const).map((key, index) => (
              <li key={key} className="flex gap-3 sm:flex-col sm:gap-1.5">
                <span aria-hidden className="w-6 shrink-0 font-display text-[30px] font-extrabold leading-none text-white/25 sm:w-auto">{index + 1}</span>
                <span className="text-sm leading-relaxed text-white/65">{t(key)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
