import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { getT } from "@/src/lib/i18n/server"

// An old placeholder page (nothing links here any more); kept working, in the page layout.
export default async function DashboardPage() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  const t = getT()
  return (
    <div className="page-top pb-10">
      <div className="page-x pt-4 sm:pt-8">
        <h1 className="font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white">{t('dashboard.title')}</h1>
        <p className="mt-4 max-w-[60ch] text-[15px] text-white/60">{t('dashboard.welcome', { name: session.user?.name ?? '' })}</p>
      </div>
    </div>
  )
}
