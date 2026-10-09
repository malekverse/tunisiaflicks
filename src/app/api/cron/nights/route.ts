// The movie nights job: reminders a day and an hour before (once each, through the `reminded`
// flags) and votes that closed with nobody on the page. cron-job.org every 15 minutes, GitHub
// every 3 hours as the fallback (see docs/SCHEDULER.md). Secret, lease and time budget: lib/cron.ts.
import { runCron } from '@/src/lib/cron'
import { runNightsJob } from '@/src/lib/movie-night'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = (r: Request) => runCron(r, 'nights', ({ deadline }) => runNightsJob({ deadline }))
