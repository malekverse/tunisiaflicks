// /activate: approving a TV from a phone (see src/lib/tv-pairing.ts). ?code= only fills the field
// in: the person still confirms it's the code on their own TV, then picks the profile. Signed out →
// sign in first (and back here); Kids and TV sessions are turned away. No referrer leaves this
// page, and it is never indexed.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'
import { MonitorSmartphone } from 'lucide-react'
import { authOptions, googleEnabled } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { getActiveProfile } from '@/src/lib/profiles'
import { isFreshLogin, isLimitedSession } from '@/src/lib/session-scope'
import { normalizeUserCode } from '@/src/lib/tv-pairing'
import { getT } from '@/src/lib/i18n/server'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import ActivateFlow from '@/src/components/tv/ActivateFlow'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return {
    title: `${getT()('tvMode.activate.metaTitle')} | TunisiaFlicks`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

export default async function ActivatePage({ searchParams }: { searchParams: { code?: string | string[] } }) {
  const raw = Array.isArray(searchParams.code) ? searchParams.code[0] : searchParams.code
  const code = normalizeUserCode(raw) ?? ''
  const here = code ? `/activate?code=${code}` : '/activate'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(here)}`)

  const t = getT()
  if (isLimitedSession(session)) {
    return (
      <div className="page-top page-x flex min-h-[70svh] items-center justify-center pb-10">
        <div className="w-full max-w-lg rounded-stage bg-white/[0.04] px-6 py-10 text-center ring-1 ring-white/[0.08] sm:px-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-white/[0.07] ring-1 ring-inset ring-white/10">
            <MonitorSmartphone aria-hidden className="h-8 w-8 text-white/85" strokeWidth={1.7} />
          </span>
          <h1 className="mt-6 text-balance font-display text-[clamp(26px,3.6vw,36px)] font-extrabold leading-[1.05] text-white">{t('tvMode.activate.tvTitle')}</h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/60">{t('tvMode.activate.tvText')}</p>
        </div>
      </div>
    )
  }

  const active = await getActiveProfile()
  if (!active) redirect(`/login?callbackUrl=${encodeURIComponent(here)}`)
  if (!active.profile) redirect(`/profiles?next=${encodeURIComponent(here)}`)
  if (active.profile.kids) {
    return <KidsBlocked what="title" title={t('tvMode.activate.kidsTitle')} description={t('tvMode.activate.kidsText')} next={here} />
  }

  const client = await clientPromise
  const user = await client.db().collection('users').findOne(
    { _id: new ObjectId(active.userId) },
    { projection: { password: 1, email: 1 } },
  )

  return (
    <ActivateFlow
      initialCode={code}
      profiles={active.profiles}
      activeProfileId={active.profile.id}
      fresh={isFreshLogin(session)}
      email={typeof user?.email === 'string' ? user.email : ''}
      hasPassword={!!user?.password}
      google={googleEnabled}
    />
  )
}
