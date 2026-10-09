"use client"
// A person page for a guest: after "Known for", an invitation to sign in and see which of this
// person's films and series they have already watched. Signing in comes back to this page.
import { ScanFace } from 'lucide-react'
import SignInInvite from '@/src/components/library/SignInInvite'
import { useT } from '@/src/components/I18nProvider'
import { richT } from '@/src/lib/i18n/rich'

export default function SeenInvite({ name }: { name: string }) {
  const t = useT()
  return <SignInInvite icon={ScanFace} title={richT(t, 'seen.invite.title', { name })} text={t('seen.invite.text')} />
}
