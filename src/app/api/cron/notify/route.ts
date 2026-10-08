// Daily release / new-episode alerts, called by Vercel Cron (see vercel.json), which sends
// "Authorization: Bearer $CRON_SECRET". Secret, lease and time budget: src/lib/cron.ts.
import { runCron } from '@/src/lib/cron'
import { runReleaseAlerts } from '@/src/lib/release-alerts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = (r: Request) => runCron(r, 'notify', async ({ deadline }) => {
  const stats = await runReleaseAlerts({ deadline })
  // Work left only because time ran out (not because the day's mail budget is spent).
  return { ...stats, more: stats.titlesSkipped > 0 || stats.emailsDeferred > 0 }
})
