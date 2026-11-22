"use client"
// /friends: your closest friends by taste (lib/social/taste bestMatches), each a tap away from the
// whole match on their page. Only scores: no titles, and nothing of it is shown to them.
import Link from 'next/link'
import { useI18n } from '@/src/components/I18nProvider'
import type { PublicIdentity } from '@/src/lib/social/types'
import { UserAvatar } from './Avatar'
import ScoreRing from './ScoreRing'

export type TasteStripItem = { person: PublicIdentity; score: number; common: number }

export default function TasteStrip({ matches }: { matches: TasteStripItem[] }) {
  const { t } = useI18n()
  if (!matches.length) return null
  return (
    <section aria-labelledby="taste-strip">
      <h2 id="taste-strip" className="font-display text-[19px] font-bold text-white sm:text-[21px]">{t('taste.strip.title')}</h2>
      <p className="mt-0.5 text-[13.5px] text-white/55">{t('taste.strip.text')}</p>
      <ul className="-mx-1 mt-3 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {matches.map(({ person, score, common }) => (
          <li key={person.handle} className="snap-start">
            <Link
              href={`/u/${person.handle}#taste`}
              aria-label={t('taste.strip.aria', { name: person.name, score, count: common })}
              className="pressable flex w-[132px] flex-col items-center gap-2 rounded-[22px] bg-white/[0.04] px-3 pb-3.5 pt-4 text-center outline-none ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <span className="relative">
                <ScoreRing score={score} size={76} />
                <span className="absolute -bottom-1 -end-1"><UserAvatar person={person} size={32} className="ring-2 ring-black" /></span>
              </span>
              <span className="mt-1 block w-full truncate text-[14px] font-semibold text-white"><bdi>{person.name}</bdi></span>
              <span className="-mt-1.5 block text-[12px] text-white/55">{t('taste.strip.common', { count: common })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
