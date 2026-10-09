"use client"
// Signed out on the movie night pages: an invitation to sign in that comes back to the same page.
import { Popcorn } from 'lucide-react'
import SignInInvite from '@/src/components/library/SignInInvite'
import { useT } from '@/src/components/I18nProvider'

export default function NightsSignedOut({ className }: { className?: string }) {
  const t = useT()
  return <SignInInvite icon={Popcorn} title={t('movieNight.signedOut.title')} text={t('movieNight.signedOut.text')} className={className} />
}
