import Link from 'next/link'
import Image from 'next/image'
import { getT } from '@/src/lib/i18n/server'
import type { TKey } from '@/src/lib/i18n'
import { supportUrl } from '@/src/lib/support-url'

/** `grownUp`: hidden on Kids profiles. `support`: only once support is open (and never for Kids: no money talk). */
type FooterLink = { href: string, label: TKey, grownUp?: boolean, support?: boolean }

const COLUMNS: { heading: TKey, links: FooterLink[] }[] = [
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
      { href: '/clips', label: 'nav.clips' },
      { href: '/swipe', label: 'swipe.title' },
      { href: '/movie-night', label: 'movieNight.nav', grownUp: true },
      { href: '/tunisian/cinema', label: 'tnCinema.title' },
      { href: '/tunisian/tv', label: 'ttv.title', grownUp: true },
      { href: '/arab-cinema', label: 'arabMap.nav' },
      { href: '/dramas', label: 'dramas.nav', grownUp: true },
      { href: '/ramadan', label: 'ramadan.title' },
    ],
  },
  {
    heading: 'footer.site',
    links: [
      { href: '/about', label: 'footer.about' },
      { href: '/contact', label: 'footer.contact' },
      { href: '/app', label: 'apps.menu' },
      { href: '/desktop', label: 'desktop.footer' },
      { href: '/support', label: 'support.footer', support: true },
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

/** Site footer: quiet, low-contrast, out of the way of the pictures. */
export default function Footer({ kids = false }: { kids?: boolean }) {
  const t = getT()
  const supportOpen = !kids && supportUrl() !== null
  const shown = (link: FooterLink) => !(kids && link.grownUp) && (!link.support || supportOpen)
  return (
    // Bottom padding on phones clears the floating tab bar.
    <footer aria-label={t('footer.aria')} className="page-x pb-tabbar mt-16 text-white/50">
      <div className="border-t border-white/[0.07] py-12">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label={t('nav.homeAria')} className="inline-flex items-center gap-3">
              <Image src="/A.svg" alt="" width={36} height={31} className="h-8 w-auto drop-shadow-[0_0_18px_rgb(255_16_0/0.4)]" />
              <Image src="/TunisiaFlicks.svg" alt="TunisiaFlicks" width={150} height={20} className="h-[18px] w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed">{t('footer.tagline')}</p>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={t(column.heading)}>
              <h2 className="mb-3 text-[13px] font-semibold text-white/85">{t(column.heading)}</h2>
              <ul className="space-y-2.5 text-sm">
                {column.links.filter(shown).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors duration-200 hover:text-white">{t(link.label)}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 text-xs md:flex-row md:items-end md:justify-between">
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
          <div className="max-w-xl space-y-1 md:text-end">
            <p>{t('footer.noHosting')}</p>
            <p>
              <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">{t('footer.tmdb')}</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
