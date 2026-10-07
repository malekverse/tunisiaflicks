import type { Metadata } from 'next'
import AuthShell from '@/src/components/auth/AuthShell'
import LoginForm from '@/src/components/auth/LoginForm'
import { googleSignInEnabled, safeCallbackUrl } from '@/src/components/auth/server'
import { getT } from '@/src/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: `${getT()('nav.signIn')} | TunisiaFlicks` }
}

type Search = { callbackUrl?: string | string[], error?: string | string[], created?: string }

export default function LoginPage({ searchParams }: { searchParams: Search }) {
  const error = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error
  return (
    <AuthShell>
      <LoginForm
        callbackUrl={safeCallbackUrl(searchParams.callbackUrl)}
        errorCode={error}
        created={searchParams.created === '1'}
        googleEnabled={googleSignInEnabled()}
      />
    </AuthShell>
  )
}
