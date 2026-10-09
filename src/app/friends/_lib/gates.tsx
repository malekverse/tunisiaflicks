// What a social page shows to someone it isn't for (yet): a guest gets an invitation to sign in
// that comes back here; a Kids profile gets KidsBlocked with the way back; a TV signed in with a
// code gets a quiet note; before a profile is picked, only the page's header (the profile gate
// is on its way to the picker).
import { MonitorX } from 'lucide-react'
import PageHeader from '@/src/components/browse/PageHeader'
import { EmptyState } from '@/src/components/MediaGrid'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { getT } from '@/src/lib/i18n/server'
import type { PageViewer } from './viewer'
import SocialSignIn from './SocialSignIn'

export function SocialGate({ viewer, title, subtitle, signIn, next }: {
  viewer: Exclude<PageViewer, { kind: 'member' }>
  title: string
  subtitle?: string
  signIn: { icon: 'friends' | 'me' | 'bell'; title: string; text: string }
  /** This page's path and query, for coming back after signing in or switching profile. */
  next: string
}) {
  const t = getT()
  if (viewer.kind === 'kids') return <KidsBlocked what="social" next={next} />
  return (
    <div className="pb-10">
      <PageHeader title={title} subtitle={subtitle} />
      {viewer.kind === 'guest' && <SocialSignIn icon={signIn.icon} title={signIn.title} text={signIn.text} callbackUrl={next} />}
      {viewer.kind === 'tv' && (
        <div className="page-x">
          <EmptyState icon={<MonitorX aria-hidden className="h-6 w-6" />} title={t('social.friends.unavailable')}>
            {t('social.errors.tv_session')}
          </EmptyState>
        </div>
      )}
      {viewer.kind === 'pick' && <div aria-busy className="min-h-[40vh]" />}
    </div>
  )
}

/** A path plus its query, rebuilt from Next's searchParams (only string values, `drop` left out). */
export function pathWithQuery(path: string, searchParams: Record<string, string | string[] | undefined> | undefined, drop: string[] = []) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (drop.includes(key)) continue
    if (typeof value === 'string') query.set(key, value)
  }
  const text = query.toString()
  return text ? `${path}?${text}` : path
}
