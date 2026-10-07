import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { getT } from "@/src/lib/i18n/server"

export default async function DashboardPage() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">{getT()('dashboard.title')}</h1>
      <p>{getT()('dashboard.welcome', { name: session.user?.name ?? '' })}</p>
    </div>
  )
}

