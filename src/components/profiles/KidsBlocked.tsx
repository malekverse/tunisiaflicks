import Link from 'next/link'
import { getT } from '@/src/lib/i18n/server'
import { KidsBadge } from './ProfileAvatar'

/** Shown instead of a title (or the Tunisian section) that a Kids profile can't watch. */
export default function KidsBlocked({ what = 'title' }: { what?: 'title' | 'tunisian' }) {
  const t = getT()
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <KidsBadge label={t('profiles.kidsBadge')} className="text-xs" />
      <h1 className="text-2xl font-bold sm:text-3xl">{t(what === 'tunisian' ? 'kids.tunisianBlocked' : 'kids.titleBlocked')}</h1>
      <p className="max-w-md text-gray-400">{t('kids.blockedDesc')}</p>
      <div className="mt-4 flex gap-4 text-sm">
        <Link href="/" className="rounded-xl bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600">{t('kids.backHome')}</Link>
        <Link href="/profiles" className="rounded-xl bg-zinc-800 px-4 py-2 font-medium text-gray-300 hover:bg-zinc-600 hover:text-white">{t('profiles.switchProfile')}</Link>
      </div>
    </div>
  )
}
