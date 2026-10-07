"use client"
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'

export type Credit = {
  id: number
  media_type: 'movie' | 'tv'
  title: string
  date: string
  role: string
  poster_path: string | null
  vote_average: number
}

const INITIAL = 24

/**
 * The career as a timeline: years down the start side (they stay pinned while their titles
 * scroll by), each title with its poster, the role, and its rating. Upcoming work comes first.
 */
export default function Filmography({ credits }: { credits: Credit[] }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const shown = all ? credits : credits.slice(0, INITIAL)

  const groups = useMemo(() => {
    const result: { label: string, items: Credit[] }[] = []
    for (const credit of shown) {
      const label = !credit.date ? t('person.noDate') : credit.date > today ? t('person.upcoming') : credit.date.slice(0, 4)
      const last = result[result.length - 1]
      if (last && last.label === label) last.items.push(credit)
      else result.push({ label, items: [credit] })
    }
    return result
  }, [shown, t, today])

  return (
    <div>
      <ol className="space-y-8">
        {groups.map((group) => (
          <li key={group.label} className="grid gap-3 sm:grid-cols-[120px_1fr] sm:gap-6">
            <h3 className="font-display text-[26px] font-extrabold leading-none text-white/35 sm:sticky sm:top-[calc(var(--topbar)+20px)] sm:self-start sm:text-[34px]">{group.label}</h3>
            <ul className="grid gap-2 md:grid-cols-2">
              {group.items.map((credit) => (
                <li key={`${credit.media_type}-${credit.id}`}>
                  <Link
                    href={`/${credit.media_type}/${credit.id}`}
                    className="group/credit flex items-center gap-4 rounded-2xl p-2 outline-none transition-colors duration-200 hover:bg-white/[0.05] focus-visible:bg-white/[0.07]"
                  >
                    <span className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-white/[0.05] ring-1 ring-white/[0.07] transition-transform duration-300 ease-out group-hover/credit:-translate-y-0.5">
                      <TmdbImage kind="poster" path={credit.poster_path} alt="" fill sizes="56px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-white/90 group-hover/credit:text-white"><bdi>{credit.title}</bdi></span>
                      {credit.role && <span className="mt-0.5 block truncate text-[13px] text-white/50"><bdi>{credit.role}</bdi></span>}
                      <span className="mt-1 flex items-center gap-3 text-[12px] text-white/40">
                        <span>{credit.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
                        {credit.vote_average > 0 && (
                          <span className="inline-flex items-center gap-1"><Star aria-hidden className="h-3 w-3 fill-star text-star" />{credit.vote_average.toFixed(1)}</span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {!all && credits.length > INITIAL && (
        <div className="mt-8 flex justify-center sm:ps-[144px]">
          <Button variant="secondary" onClick={() => setAll(true)}>{t('person.showAll', { count: credits.length })}</Button>
        </div>
      )}
    </div>
  )
}
