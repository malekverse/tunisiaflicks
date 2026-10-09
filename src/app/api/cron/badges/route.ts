// The nightly badges job: cron-job.org at 03:10 (Africa/Tunis), GitHub as the fallback (see
// docs/SCHEDULER.md). Secret, lease and time budget: src/lib/cron.ts. The work: src/lib/badges/cron.ts.
import { runCron } from '@/src/lib/cron'
import { runBadgesCron } from '@/src/lib/badges/cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = (r: Request) => runCron(r, 'badges', ({ deadline }) => runBadgesCron({ deadline }))
