import type { Metadata } from 'next'
import AuthShell from '@/src/components/auth/AuthShell'
import SignupForm from '@/src/components/auth/SignupForm'
import { googleSignInEnabled, safeCallbackUrl } from '@/src/components/auth/server'
import { getT } from '@/src/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: `${getT()('nav.createAccount')} | TunisiaFlicks` }
}

export default function SignUpPage({ searchParams }: { searchParams: { callbackUrl?: string | string[] } }) {
  return (
    <AuthShell>
      <SignupForm callbackUrl={safeCallbackUrl(searchParams.callbackUrl)} googleEnabled={googleSignInEnabled()} />
    </AuthShell>
  )
}
