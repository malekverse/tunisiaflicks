import Link from 'next/link'
import { House, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { getT } from '@/src/lib/i18n/server'
import { KidsBadge } from './ProfileAvatar'

/** Shown instead of a title (or the Tunisian section) that a Kids profile can't watch. */
export default function KidsBlocked({ what = 'title' }: { what?: 'title' | 'tunisian' }) {
  const t = getT()
  return (
    <div className="page-top page-x flex min-h-[70svh] items-center justify-center pb-10">
      <div className="relative isolate w-full max-w-lg overflow-hidden rounded-stage bg-white/[0.04] px-6 py-10 text-center ring-1 ring-white/[0.08] sm:px-10 sm:py-12">
        <div aria-hidden className="absolute -top-28 left-1/2 -z-10 h-56 w-72 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400/25 to-pink-500/25 blur-3xl" />
        <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-white/[0.07] ring-1 ring-inset ring-white/10">
          <ShieldCheck aria-hidden className="h-8 w-8 text-white/85" strokeWidth={1.7} />
          <KidsBadge label={t('profiles.kidsBadge')} className="absolute -bottom-2 left-1/2 -translate-x-1/2" />
        </span>
        <h1 className="mt-7 text-balance font-display text-[clamp(26px,3.6vw,36px)] font-extrabold leading-[1.05] text-white">
          {t(what === 'tunisian' ? 'kids.tunisianBlocked' : 'kids.titleBlocked')}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/60">{t('kids.blockedDesc')}</p>
        <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button asChild size="lg"><Link href="/"><House aria-hidden className="h-[18px] w-[18px]" />{t('kids.backHome')}</Link></Button>
          <Button asChild size="lg" variant="secondary"><Link href="/profiles"><Users aria-hidden className="h-[18px] w-[18px]" />{t('profiles.switchProfile')}</Link></Button>
        </div>
      </div>
    </div>
  )
}
