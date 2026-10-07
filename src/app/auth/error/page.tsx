import type { Metadata } from 'next'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { getT } from '@/src/lib/i18n/server'
import AuthShell from '@/src/components/auth/AuthShell'
import AuthHeader from '@/src/components/auth/AuthHeader'
import LogAuthError from '@/src/components/auth/LogAuthError'
import { StateIcon } from '@/src/components/auth/fields'
import { Button } from '@/src/components/ui/button'

export function generateMetadata(): Metadata {
  return { title: `${getT()('auth.errorTitle')} | TunisiaFlicks`, robots: { index: false } }
}

// next-auth lands here with ?error=<code> when a sign-in fails before reaching the login page.
export default function AuthError({ searchParams }: { searchParams: { error?: string | string[] } }) {
  const t = getT()
  const code = Array.isArray(searchParams.error) ? searchParams.error[0] : searchParams.error

  return (
    <AuthShell>
      <LogAuthError code={code} />
      <StateIcon className="mb-6"><TriangleAlert className="h-7 w-7" strokeWidth={1.8} /></StateIcon>
      <AuthHeader title={t('auth.errorHeading')} subtitle={t('auth.errorFallback')} />
      {code && (
        <p className="-mt-3 mb-7 inline-flex max-w-full rounded-full bg-white/[0.06] px-3 py-1 text-[13px] text-white/60 ring-1 ring-inset ring-white/10">
          <span className="truncate">{t('auth.errorCode', { code })}</span>
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/login">{t('error.retry')}</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href="/">{t('error.home')}</Link>
        </Button>
      </div>
    </AuthShell>
  )
}
