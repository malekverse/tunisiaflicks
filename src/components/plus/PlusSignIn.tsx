"use client"
// TunisiaFlicks+, signed out: what it is, and the way in (back here after signing in).
import { Crown } from 'lucide-react'
import PageHeader from '@/src/components/browse/PageHeader'
import SignInInvite from '@/src/components/library/SignInInvite'
import { useT } from '@/src/components/I18nProvider'

export default function PlusSignIn() {
  const t = useT()
  return (
    <div className="pb-12">
      <PageHeader title="TunisiaFlicks+" subtitle={t('plus.subtitle')} />
      <SignInInvite icon={Crown} title={t('plus.signInTitle')} text={t('plus.signInText')} callbackUrl="/plus" />
    </div>
  )
}
