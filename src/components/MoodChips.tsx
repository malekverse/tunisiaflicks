import Link from 'next/link'
import { getT } from '@/src/lib/i18n/server'
import type { TKey } from '@/src/lib/i18n'

// One-tap "what do I feel like tonight" shortcuts into pre-filtered Discover views.
const MOODS: { href: string, emoji: string, label: TKey, plain?: boolean }[] = [
  { href: '/discover?runtime=90&sort=top', emoji: '⏱️', label: 'mood.short' },
  { href: '/discover?family=1&sort=top', emoji: '👨‍👩‍👧', label: 'mood.family' },
  { href: '/discover?runtime=epic&sort=top', emoji: '🍿', label: 'mood.epic' },
  { href: '/discover?sort=newest', emoji: '✨', label: 'mood.new' },
  { href: '/discover?type=tv&runtime=90&sort=top', emoji: '📺', label: 'mood.bingeable' },
  // A route handler: plain <a> so every click is a fresh random pick.
  { href: '/surprise', emoji: '🎲', label: 'nav.surprise', plain: true },
]

export default function MoodChips() {
  const t = getT()
  const chip = 'shrink-0 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:border-red-500 hover:text-red-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-200 dark:hover:border-red-500 dark:hover:text-white'
  return (
    <nav aria-label={t('mood.title')} className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      <span className="shrink-0 text-sm font-semibold text-gray-500 me-1">{t('mood.title')}</span>
      {MOODS.map((mood) => {
        const content = <><span aria-hidden="true">{mood.emoji}</span>{t(mood.label)}</>
        return mood.plain
          ? <a key={mood.href} href={mood.href} className={chip}>{content}</a>
          : <Link key={mood.href} href={mood.href} className={chip}>{content}</Link>
      })}
    </nav>
  )
}
