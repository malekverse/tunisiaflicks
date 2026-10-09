"use client"
// "Deciding right now?": the way to Swipe to decide, for a film tonight without planning anything.
// One link; the little thrown cards say what happens there (a nope to the left, a yes to the right).
import Link from 'next/link'
import { ChevronRight, Heart, X } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'

export default function DecideNowCard({ className }: { className?: string }) {
  const t = useT()
  return (
    <Link
      href="/swipe"
      className={cn(
        'group pressable relative flex items-center gap-5 overflow-hidden rounded-[22px] bg-white/[0.04] p-5 outline-none ring-1 ring-inset ring-white/[0.07] transition-colors duration-150 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500 sm:p-6',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[21px] font-bold leading-tight text-white">{t('movieNight.decide.title')}</span>
        <span className="mt-1.5 block max-w-[34ch] text-[14px] leading-relaxed text-white/60">{t('movieNight.decide.text')}</span>
        <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-white">
          {t('movieNight.decide.action')}
          <ChevronRight aria-hidden className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </span>
      </span>
      {/* Two cards mid-throw: decorative, the same gesture in every language. */}
      <span aria-hidden className="relative h-[92px] w-[84px] shrink-0">
        <span className="absolute start-0 top-3 h-[72px] w-12 -rotate-[12deg] rounded-[8px] bg-white/[0.05] ring-1 ring-inset ring-white/10" />
        <span className="absolute end-0 top-1 h-[72px] w-12 rotate-[10deg] rounded-[8px] bg-gradient-to-b from-white/[0.14] to-white/[0.05] ring-1 ring-inset ring-white/15" />
        <span className="absolute -start-1 top-0 grid h-6 w-6 place-items-center rounded-full bg-white text-black ring-2 ring-black"><X className="h-3.5 w-3.5" strokeWidth={2.6} /></span>
        <span className="absolute -end-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-red-600 text-white ring-2 ring-black"><Heart className="h-3.5 w-3.5 fill-current" strokeWidth={2} /></span>
      </span>
    </Link>
  )
}
