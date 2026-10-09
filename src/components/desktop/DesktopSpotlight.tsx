"use client"
// /app's spotlight on the Windows desktop app: one card, the whole of it a link to /desktop, with a
// small picture of the app. Not shown inside the desktop app itself.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { isDesktopApp } from '@/src/hooks/use-desktop-app'
import type { ShowcaseFilm } from '@/src/lib/desktop-showcase'
import AppWindowMock from './AppWindowMock'

export default function DesktopSpotlight({ film }: { film: ShowcaseFilm | null }) {
  const t = useT()
  const [inApp, setInApp] = useState(false)
  useEffect(() => setInApp(isDesktopApp()), [])
  if (inApp) return null

  return (
    <div className="page-x mb-5">
      <Link
        href="/desktop"
        className="pressable group relative isolate grid items-center gap-6 overflow-hidden rounded-[22px] bg-white/[0.045] p-5 outline-none ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-red-500 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
      >
        <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgb(255_36_20/0.2),transparent)]" />
        <div className="min-w-0">
          <h2 className="font-display text-[24px] font-extrabold leading-[1.02] text-white sm:text-[32px]">{t('desktop.spotlight.title')}</h2>
          <p className="mt-2 text-[15px] text-white/65">{t('desktop.spotlight.text')}</p>
          <span className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-red-600 ps-5 pe-4 text-[14.5px] font-semibold text-white transition-colors group-hover:bg-red-500">
            {t('desktop.card.more')}<ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
          </span>
        </div>
        <div aria-hidden className="hidden sm:block">
          <AppWindowMock film={film} compact />
        </div>
      </Link>
    </div>
  )
}
