"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import { cn } from '@/src/lib/utils'

/**
 * The signed-out state of a page that needs an account: an invitation rather than a redirect. The
 * section's icon sits in a little fan of empty poster frames, waiting to be filled. Signing in (or
 * up) comes back to this very page, query included (an ?invite= link keeps working), unless
 * `callbackUrl` says otherwise. `title` and `text` default to the library's copy.
 */
export default function SignInInvite({ icon: Icon, title, text, callbackUrl, className }: {
  icon: LucideIcon
  title?: React.ReactNode
  text?: React.ReactNode
  callbackUrl?: string
  className?: string
}) {
  const t = useT()
  // The address is only known in the browser (the query isn't available to a static render).
  const [here, setHere] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!callbackUrl) setHere(window.location.pathname + window.location.search)
  }, [callbackUrl])
  const back = callbackUrl ?? here

  return (
    <section className={cn('page-x', className)}>
      <div className="relative isolate overflow-hidden rounded-[24px] bg-gradient-to-br from-red-600/[0.22] via-white/[0.04] to-white/[0.02] p-6 ring-1 ring-white/10 rtl:bg-gradient-to-bl sm:rounded-stage sm:p-10 lg:p-12">
        {/* A soft pool of light behind the frames. */}
        <div aria-hidden className="absolute -end-24 -top-24 -z-10 h-80 w-80 rounded-full bg-red-600/20 blur-3xl" />

        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <p className="font-display text-[clamp(28px,3.4vw,44px)] font-extrabold leading-[0.95] text-white">{title ?? t('nav.signInTitle')}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">{text ?? t('nav.signInText')}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button asChild size="lg"><Link href={withCallback('/login', back)}>{t('nav.signIn')}</Link></Button>
              <Button asChild size="lg" variant="secondary"><Link href={withCallback('/signup', back)}>{t('nav.createAccount')}</Link></Button>
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
