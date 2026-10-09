// The weekly digest job: cron-job.org every 10 minutes Friday to Sunday, GitHub as the fallback
// (see docs/SCHEDULER.md). Secret, lease and time budget: src/lib/cron.ts.
import { runCron } from '@/src/lib/cron'
import { runWeeklyDigest } from '@/src/lib/digest/run'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = (r: Request) => runCron(r, 'digest', ({ deadline }) => runWeeklyDigest({ deadline }))
