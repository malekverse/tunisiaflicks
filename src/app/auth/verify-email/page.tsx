import type { Metadata } from 'next'
import Link from 'next/link'
import { Link2Off } from 'lucide-react'
import { getT } from '@/src/lib/i18n/server'
import { verifyEmailToken } from '@/src/lib/verification'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'
import AuthShell from '@/src/components/auth/AuthShell'
import AuthHeader from '@/src/components/auth/AuthHeader'
import { StateIcon, SuccessCheck } from '@/src/components/auth/fields'
import { Button } from '@/src/components/ui/button'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { title: `${getT()('verify.title')} | TunisiaFlicks`, robots: { index: false } }
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  const t = getT()
  const result = await verifyEmailToken(String(searchParams.token ?? ''))
  const success = result !== 'invalid'

  return (
    <AuthShell>
      <div role={success ? 'status' : undefined}>
        {success
          ? <SuccessCheck className="mb-6" />
          : <StateIcon className="mb-6"><Link2Off className="h-7 w-7" strokeWidth={1.8} /></StateIcon>}
        <AuthHeader
          title={t(success ? 'verify.successTitle' : 'verify.invalidTitle')}
          subtitle={t(result === 'verified' ? 'verify.successDesc' : result === 'already' ? 'verify.alreadyDesc' : 'verify.invalidDesc')}
        />
        {success ? (
          <Button asChild size="lg" className="w-full">
            <Link href="/">{t('kids.backHome')}</Link>
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <ResendVerificationButton />
            <Link href="/" className="mx-auto rounded-md text-[14px] font-medium text-white/60 underline-offset-4 outline-none transition-colors hover:text-white hover:underline focus-visible:underline">
              {t('kids.backHome')}
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
