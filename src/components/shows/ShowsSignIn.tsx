"use client"
// My shows, signed out: what the page does, and the way in (back here after signing in).
import { Tv } from 'lucide-react'
import PageHeader from '@/src/components/browse/PageHeader'
import SignInInvite from '@/src/components/library/SignInInvite'
import { useT } from '@/src/components/I18nProvider'

export default function ShowsSignIn() {
  const t = useT()
  return (
    <div className="pb-12">
      <PageHeader title={t('shows.title')} subtitle={t('shows.subtitle')} />
      <SignInInvite icon={Tv} title={t('shows.signInTitle')} text={t('shows.signInText')} callbackUrl="/shows" />
    </div>
  )
}
