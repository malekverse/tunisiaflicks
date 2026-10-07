"use client"
import { useId } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'

/** Two or three sibling pages as a segmented control; the white pill slides to the current one. */
export default function SegmentedLinks({ items, label, className }: {
  items: { href: string, label: string, active: boolean }[]
  label: string
  className?: string
}) {
  const id = useId()
  return (
    <nav aria-label={label} className={cn('relative flex w-fit rounded-full bg-white/[0.07] p-1', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? 'page' : undefined}
          className={cn('relative h-9 rounded-full px-5 text-[14px] font-medium leading-9 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500', item.active ? 'text-black' : 'text-white/70 hover:text-white')}
        >
          {item.active && <m.span layoutId={`segment-${id}`} transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
          <span className="relative">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
