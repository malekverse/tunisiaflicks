"use client"
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'

/**
 * Signed-out library page: an invitation rather than a redirect. The section's icon sits in a
 * little fan of empty poster frames, waiting to be filled.
 */
export default function SignInInvite({ icon: Icon, className }: { icon: LucideIcon, className?: string }) {
  const t = useT()
  return (
    <section className={cn('page-x', className)}>
      <div className="relative isolate overflow-hidden rounded-[24px] bg-gradient-to-br from-red-600/[0.22] via-white/[0.04] to-white/[0.02] p-6 ring-1 ring-white/10 rtl:bg-gradient-to-bl sm:rounded-stage sm:p-10 lg:p-12">
        {/* A soft pool of light behind the frames. */}
        <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-80 w-80 rounded-full bg-red-600/20 blur-3xl" />

        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <p className="font-display text-[clamp(28px,3.4vw,44px)] font-extrabold leading-[0.95] text-white">{t('nav.signInTitle')}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">{t('nav.signInText')}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button asChild size="lg"><Link href="/login">{t('nav.signIn')}</Link></Button>
              <Button asChild size="lg" variant="secondary"><Link href="/signup">{t('nav.createAccount')}</Link></Button>
            </div>
          </div>

          <div aria-hidden className="relative mx-auto hidden h-44 w-60 shrink-0 sm:block lg:me-6">
            <span className="absolute start-2 top-5 h-36 w-24 -rotate-[9deg] rounded-poster bg-white/[0.04] ring-1 ring-inset ring-white/10" />
            <span className="absolute end-2 top-5 h-36 w-24 rotate-[9deg] rounded-poster bg-white/[0.04] ring-1 ring-inset ring-white/10" />
            <span className="absolute inset-x-0 top-0 mx-auto grid h-40 w-[106px] place-items-center rounded-poster bg-gradient-to-b from-white/[0.12] to-white/[0.04] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-inset ring-white/15 backdrop-blur-sm">
              <Icon className="h-9 w-9 text-white/85" strokeWidth={1.6} />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
