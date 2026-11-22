"use client"
// The bottom of each way to pick a film: the other ways, one tap away.
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { PLAY_TOOLS, isNewTool } from './tools'

export default function MoreWays({ current }: { current: string }) {
  const t = useT()
  const others = PLAY_TOOLS.filter((tool) => tool.href !== current)
  return (
    <section aria-labelledby="more-ways" className="mt-12">
      <h2 id="more-ways" className="font-display text-[21px] font-bold leading-tight text-white sm:text-[24px]">{t('play.more')}</h2>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {others.map((tool) => {
          const Icon = tool.icon
          return (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="group pressable flex h-full min-h-[72px] items-center gap-3.5 rounded-[20px] bg-white/[0.04] px-4 py-3.5 outline-none ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07]"><Icon aria-hidden className="h-5 w-5 text-white/85" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-white">{t(tool.label)}</span>
                    {isNewTool(tool) && <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-red-300">{t('play.new')}</span>}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-white/60">{t(tool.text)}</span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/45 rtl:rotate-180" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
