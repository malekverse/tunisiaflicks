import type { Metadata } from 'next'
import Link from 'next/link'
import { getT } from '@/src/lib/i18n/server'
import { verifyEmailToken } from '@/src/lib/verification'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return { title: `${getT()('verify.title')} | TunisiaFlicks`, robots: { index: false } }
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  const t = getT()
  const result = await verifyEmailToken(String(searchParams.token ?? ''))
  const success = result !== 'invalid'

  return (
    <div className="flex w-full justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-zinc-800 dark:bg-black">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${success ? 'bg-green-600/15 text-green-500' : 'bg-red-600/15 text-red-500'}`}>
          {success ? '✓' : '!'}
        </div>
        <h1 className="text-2xl font-bold">{t(success ? 'verify.successTitle' : 'verify.invalidTitle')}</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          {t(result === 'verified' ? 'verify.successDesc' : result === 'already' ? 'verify.alreadyDesc' : 'verify.invalidDesc')}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          {!success && <ResendVerificationButton />}
          <Link href="/" className="text-sm text-red-500 hover:underline">{t('kids.backHome')}</Link>
        </div>
      </div>
    </div>
  )
}
