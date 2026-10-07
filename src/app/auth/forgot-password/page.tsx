import type { Metadata } from 'next'
import AuthShell from '@/src/components/auth/AuthShell'
import ForgotPasswordForm from '@/src/components/auth/ForgotPasswordForm'
import { getT } from '@/src/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: `${getT()('auth.forgotLink')} | TunisiaFlicks`, robots: { index: false } }
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  )
}
