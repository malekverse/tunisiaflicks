import type { Metadata } from 'next'
import AuthShell from '@/src/components/auth/AuthShell'
import { getT } from '@/src/lib/i18n/server'
import ResetPasswordForm from './reset-password-form'

export function generateMetadata(): Metadata {
  return { title: `${getT()('auth.resetHeading')} | TunisiaFlicks`, robots: { index: false } }
}

// The token comes from the link in the reset email (?token=...), read on the server.
export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string | string[] } }) {
  const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token
  return (
    <AuthShell>
      <ResetPasswordForm token={token || null} />
    </AuthShell>
  )
}
