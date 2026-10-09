// /me, "Your page": with a handle, straight to /u/[handle]. Without one: your badges, your year,
// your lists, and the card that makes the page friends can find. Kids profiles: badges and their
// year only. Guests: an invitation to sign in that comes back here.
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import ProfileBadges from '@/src/components/badges/ProfileBadges'
import PageHeader from '@/src/components/browse/PageHeader'
import ProfileLists from '@/src/components/lists/ProfileLists'
import { UserAvatar } from '@/src/components/social/Avatar'
import ProfileSetupCard from '@/src/components/social/ProfileSetupCard'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import type { ProfileRef } from '@/src/lib/social/types'
import { rgbTriplet } from '../friends/_lib/feed'
import SocialSignIn from '../friends/_lib/SocialSignIn'
import { pageViewer } from '../friends/_lib/viewer'
import { getActiveProfile } from '@/src/lib/profiles'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('social.menu.yourPage'), description: t('social.me.subtitle'), path: '/me', noIndex: true })
}

/** 'Your year': a framed card in the profile's colour, the whole card one link to /wrapped. */
function YourYearCard({ color }: { color: string }) {
  const t = getT()
  const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Africa/Tunis', year: 'numeric' }).format(new Date()))
  const rgb = rgbTriplet(color) ?? '255 36 20'
  return (
    <section className="page-x">
      <Link
        href="/wrapped"
        className="group pressable relative isolate flex min-h-[148px] items-center overflow-hidden rounded-[22px] p-6 outline-none ring-1 ring-inset ring-white/10 transition-shadow focus-visible:ring-2 focus-visible:ring-red-500 sm:min-h-[168px] sm:p-8"
        style={{ backgroundImage: `linear-gradient(120deg, rgb(${rgb} / 0.34), rgb(${rgb} / 0.1) 55%, rgb(255 255 255 / 0.02))` }}
      >
        {/* The year itself, as an outline on the far side. */}
        <span aria-hidden dir="ltr" className="numeral-outline pointer-events-none absolute -bottom-6 end-4 -z-10 select-none font-display text-[clamp(96px,16vw,180px)] font-extrabold leading-none transition-transform duration-500 ease-out group-hover:-translate-y-1">
          {year}
        </span>
        <span className="max-w-[34ch]">
          <span className="flex items-center gap-1.5 font-display text-[26px] font-extrabold leading-tight text-white sm:text-[30px]">
            {t('social.me.yearTitle')}
            <ChevronRight aria-hidden className="h-6 w-6 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </span>
          <span className="mt-1.5 block text-[15px] leading-relaxed text-white/75">{t('social.me.yearText', { year })}</span>
        </span>
      </Link>
    </section>
  )
}

export default async function MePage() {
  const t = getT()
  const viewer = await pageViewer()
  const title = t('social.menu.yourPage')
  const subtitle = t('social.me.subtitle')

  if (viewer.kind === 'guest' || viewer.kind === 'pick') {
    return (
      <div className="pb-10">
        <PageHeader title={title} subtitle={subtitle} />
        {viewer.kind === 'guest'
          ? <SocialSignIn icon="me" title={t('social.me.signInTitle')} text={t('social.me.signInText')} callbackUrl="/me" />
          : <div aria-busy className="min-h-[40vh]" />}
      </div>
    )
  }
  if (viewer.kind === 'member' && viewer.social) redirect(`/u/${viewer.social.handle}`)

  const active = await getActiveProfile()
  const profile = active?.profile
  const owner: ProfileRef = viewer.ref
  const person = { name: profile?.name ?? '?', color: profile?.color ?? '#dc2626' }
  // Kids profiles (and TVs signed in with a code) only get their badges and their year.
  const grownUp = viewer.kind === 'member'

  return (
    <div className="pb-10">
      <PageHeader title={title} subtitle={grownUp ? subtitle : t('social.me.subtitleKids')} icon={<UserAvatar person={person} size={56} />} />
      <div className="space-y-10 sm:space-y-12">
        <Suspense fallback={null}>
          <div className="page-x empty:hidden"><ProfileBadges owner={owner} view="owner" /></div>
        </Suspense>
        <YourYearCard color={person.color} />
        {grownUp && (
          <Suspense fallback={null}>
            <ProfileLists owner={owner} viewer={owner} view="owner" linkAccess={false} />
          </Suspense>
        )}
        {grownUp && (
          <div className="page-x"><div className="max-w-[760px]"><ProfileSetupCard /></div></div>
        )}
      </div>
    </div>
  )
}
