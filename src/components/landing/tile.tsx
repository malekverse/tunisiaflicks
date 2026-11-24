"use client"
// The glass tile every demo of the landing page's bento sits in (Tools, MoreTiles), and its link.
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { useSpotlight } from './parts'
import styles from './landing.module.css'

/** The glass tile every demo sits in: a specular edge follows the pointer. */
export function Tile({ title, text, children, className, footer, art }: {
  title: TKey
  text: TKey
  children?: React.ReactNode
  className?: string
  footer?: React.ReactNode
  art?: React.ReactNode
}) {
  const { t } = useI18n()
  const ref = useSpotlight<HTMLDivElement>()
  return (
    <div ref={ref} className={cn(styles['glass-tile'], 'flex h-full flex-col overflow-hidden rounded-[22px] p-5 sm:p-6', className)}>
      {art}
      <div className="relative z-[1] flex-1">{children}</div>
      <div className="relative z-[1] mt-5">
        <h3 className="font-display text-[22px] font-bold leading-tight text-white sm:text-[26px]">{t(title)}</h3>
        <p className="mt-1.5 max-w-[46ch] text-pretty text-[14px] leading-relaxed text-white/65 sm:text-[15px]">{t(text)}</p>
        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  )
}

export function TileLink({ href, children }: { href: string, children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center gap-1 rounded-full bg-white/[0.1] pe-3.5 ps-4 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.18] active:scale-[0.97]">
      {children}
      <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
    </Link>
  )
}
