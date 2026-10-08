"use client"
// People on the site: a round colour tile with an initial (their profile's colour), or the account
// photo when they chose to show it. Film people (cast) are photos in their own components; site
// people always look like this, so the two never mix.
import Link from 'next/link'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'
import type { AvatarPerson } from '@/src/lib/social/types'

const TEXT: Record<number, string> = {
  24: 'text-[11px]',
  32: 'text-[13px]',
  40: 'text-[16px]',
  56: 'text-[22px]',
  96: 'text-[38px]',
  128: 'text-[50px]',
}

/** The first letter of a name, whatever the script ('ﻷ' and emoji included). */
const initialOf = (name: string) => Array.from(name.trim())[0]?.toUpperCase() ?? '?'

export function UserAvatar({ person, size, className }: { person: AvatarPerson; size: 24 | 32 | 40 | 56 | 96 | 128; className?: string }) {
  const photo = person.image ? `${person.image}${person.image.includes('?') ? '&' : '?'}s=${size <= 32 ? 64 : size <= 56 ? 128 : 256}` : null
  return (
    <span
      aria-hidden
      className={cn('relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-display font-bold leading-none text-white', TEXT[size], className)}
      style={{ width: size, height: size, backgroundColor: person.color }}
    >
      {/* Light from above, like every surface in the room. */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20" />
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt="" width={size} height={size} loading="lazy" decoding="async" className="relative h-full w-full object-cover" />
        : <span className="relative drop-shadow-[0_1px_6px_rgb(0_0_0/0.25)]">{initialOf(person.name)}</span>}
    </span>
  )
}

/**
 * Up to three overlapping avatars and a "+N" pill. The overlap is logical (margin-inline-start on
 * every avatar but the first), so the stack reads the same way in Arabic.
 */
export function AvatarStack({ people, total, size = 24, label, className }: { people: AvatarPerson[]; total?: number; size?: 24 | 32; label?: string; className?: string }) {
  const t = useT()
  const shown = people.slice(0, 3)
  const more = Math.max(0, (total ?? people.length) - shown.length)
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex items-center [&>*+*]:-ms-2', className)}
    >
      {shown.map((person, index) => (
        <UserAvatar key={`${person.handle ?? person.name}-${index}`} person={person} size={size} className="ring-2 ring-black" />
      ))}
      {more > 0 && (
        <span
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center rounded-full bg-[#2a2a2e] px-1.5 font-semibold tabular-nums text-white/85 ring-2 ring-black',
            size === 24 ? 'h-6 min-w-6 text-[10.5px]' : 'h-8 min-w-8 text-[12px]',
          )}
          title={t('social.avatar.more', { count: more })}
        >
          +{more > 99 ? 99 : more}
        </span>
      )}
    </span>
  )
}

/** A person as a small pill (avatar and name), linking to their page when there is one. */
export function PersonChip({ person, href }: { person: AvatarPerson; href?: string | null }) {
  const target = href === undefined ? (person.handle ? `/u/${person.handle}` : null) : href
  const content = (
    <>
      <UserAvatar person={person} size={24} />
      <bdi className="min-w-0 truncate">{person.name}</bdi>
    </>
  )
  const className = 'inline-flex h-8 max-w-full items-center gap-2 rounded-full bg-white/[0.06] pe-3 ps-1 text-[13.5px] font-medium text-white'
  return target
    ? <Link href={target} className={cn(className, 'pressable outline-none transition-colors hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-red-500')}>{content}</Link>
    : <span className={className}>{content}</span>
}
