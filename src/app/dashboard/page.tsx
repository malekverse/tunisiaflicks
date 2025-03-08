import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Welcome, {session.user?.name}! This is your private dashboard.</p>
    </div>
  )
}

