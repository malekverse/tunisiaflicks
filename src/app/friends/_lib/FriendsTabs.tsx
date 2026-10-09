"use client"
// Activity | Your friends: the two Friends pages as a segmented control whose white pill slides
// between them (it lives in the shared layout, so it survives the navigation). The second one
// carries the requests waiting: a red dot only while one is unread, otherwise a quiet count.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m } from 'framer-motion'
import { useT } from '@/src/components/I18nProvider'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

export default function FriendsTabs({ waiting, unread }: { waiting: number; unread: number }) {
  const t = useT()
  const pathname = usePathname()
  const items = [
    { href: '/friends', label: t('social.friends.tabActivity'), active: pathname === '/friends' },
    { href: '/friends/list', label: t('social.friends.tabList'), active: pathname.startsWith('/friends/list'), badge: true },
  ]
  return (
    <nav aria-label={t('social.friends.tabs')} className="relative flex w-fit rounded-full bg-white/[0.07] p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'relative inline-flex h-10 select-none items-center gap-2 rounded-full px-5 text-[14px] font-medium outline-none transition-colors duration-200 [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-red-500',
            item.active ? 'text-black' : 'text-white/70 hover:text-white',
          )}
        >
          {item.active && <m.span layoutId="friends-tabs-pill" transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
          <span className="relative">{item.label}</span>
          {item.badge && waiting > 0 && (
            <>
              <span className="sr-only">{t('social.together.requestsAria', { count: waiting })}</span>
              {unread > 0 ? (
                // Red only while something is unread: the signal light.
                <span aria-hidden className="relative h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgb(255_36_20)]" />
              ) : (
                <span aria-hidden className={cn('relative grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums', item.active ? 'bg-black/10 text-black/75' : 'bg-white/15 text-white')}>
                  {waiting > 9 ? '9+' : waiting}
                </span>
              )}
            </>
          )}
        </Link>
      ))}
    </nav>
  )
}
