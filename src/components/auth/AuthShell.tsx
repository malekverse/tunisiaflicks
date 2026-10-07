import Image from 'next/image'
import { getT } from '@/src/lib/i18n/server'
import { cn } from '@/src/lib/utils'
import PosterWall from './PosterWall'
import { getWallPosters } from './server'

/**
 * The frame every sign-in page shares (login, sign-up, password reset, email check, auth errors).
 * Desktop: the poster wall fills the start side with the logo and one line over it, and the form
 * sits in a calm glass panel on the end side. Phones: the wall becomes a dim backdrop behind the
 * panel.
 */
export default async function AuthShell({ children, className }: { children: React.ReactNode, className?: string }) {
  const [posters, t] = [await getWallPosters(), getT()]

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 lg:end-auto lg:w-[66%]">
        <PosterWall posters={posters} className="opacity-50 lg:opacity-90" />
        {/* Dimmed so the pictures glow rather than shout; faded into the black on every edge that
            meets the page (the end side, the bottom, behind the top bar). */}
        <div className="absolute inset-0 bg-black/55 lg:bg-black/40" />
        <div className="absolute inset-y-0 end-0 hidden w-3/5 bg-gradient-to-l from-black via-black/80 to-transparent rtl:bg-gradient-to-r lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_45%,transparent_40%,rgb(0_0_0/0.55))]" />
      </div>

      <div className="page-x page-top grid min-h-[100svh] items-center pb-[max(40px,var(--tabbar-space))] lg:grid-cols-[minmax(0,1fr)_minmax(380px,432px)] lg:gap-16 lg:pb-16 xl:gap-28">
        <div className="hidden max-w-[30rem] self-end pb-[4vh] lg:block">
          <div className="flex items-center gap-3">
            <Image src="/A.svg" alt="" width={44} height={38} className="h-9 w-auto drop-shadow-[0_0_22px_rgb(255_16_0/0.55)]" />
            <Image src="/TunisiaFlicks.svg" alt="TunisiaFlicks" width={160} height={21} className="h-5 w-auto" />
          </div>
          <p className="text-shadow-soft mt-6 text-balance font-display text-[clamp(34px,3.3vw,50px)] font-extrabold leading-[0.98] text-white">
            {t('footer.tagline')}
          </p>
        </div>

        <div
          className={cn(
            'glass-strong mx-auto w-full max-w-[432px] rounded-stage p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_40px_120px_-30px_rgb(0_0_0/0.95)] sm:p-8 lg:mx-0',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

