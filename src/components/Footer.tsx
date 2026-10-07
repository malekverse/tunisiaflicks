import Link from 'next/link'
import Image from 'next/image'
import { getT } from '@/src/lib/i18n/server'
import type { TKey } from '@/src/lib/i18n'

const COLUMNS: { heading: TKey, links: { href: string, label: TKey }[] }[] = [
  {
    heading: 'footer.browse',
    links: [
      { href: '/', label: 'nav.movies' },
      { href: '/tv', label: 'nav.tvShows' },
      { href: '/discover', label: 'nav.discover' },
      { href: '/tunisian', label: 'nav.tunisian' },
      { href: '/upcoming', label: 'nav.comingSoon' },
    ],
  },
  {
    heading: 'footer.explore',
    links: [
      { href: '/swipe', label: 'swipe.title' },
      { href: '/tunisian/cinema', label: 'tnCinema.title' },
      { href: '/ramadan', label: 'ramadan.title' },
    ],
  },
  {
    heading: 'footer.site',
    links: [
      { href: '/about', label: 'footer.about' },
      { href: '/contact', label: 'footer.contact' },
    ],
  },
  {
    heading: 'footer.legal',
    links: [
      { href: '/privacy', label: 'footer.privacy' },
      { href: '/terms', label: 'footer.terms' },
      { href: '/dmca', label: 'footer.dmca' },
    ],
  },
]

/** Site footer: sits under the page content, beside the sidebar (it lives in the content column). */
export default function Footer() {
  const t = getT()
  return (
    // Bottom padding on mobile clears the fixed bottom navigation bar.
    <footer aria-label={t('footer.aria')} className="mt-8 border-t border-gray-200 bg-gray-50 text-gray-600 dark:border-zinc-900 dark:bg-black dark:text-gray-400 pb-20 sm:pb-0">
      <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-14 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label={t('nav.homeAria')} className="inline-flex items-center gap-3">
              <Image src="/A.svg" alt="" width={40} height={35} className="h-8 w-auto" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">TunisiaFlicks</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm">{t('footer.tagline')}</p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading)}>
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{t(column.heading)}</h2>
              <ul className="space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-red-500 transition-colors">{t(link.label)}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-gray-200 pt-6 text-xs dark:border-zinc-900 md:flex-row md:items-center md:justify-between">
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
          <div className="space-y-1 md:text-end">
            <p>{t('footer.noHosting')}</p>
            <p>
              <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="hover:text-red-500">{t('footer.tmdb')}</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
