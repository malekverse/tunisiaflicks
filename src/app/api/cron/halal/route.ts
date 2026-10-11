// The Halal mode warm-up job: grades the main lists' titles ahead, so viewers in Halal mode get the
// AI's decision instead of the strict fallback (see lib/halal). cron-job.org every 6 hours, GitHub
// as the fallback (docs/SCHEDULER.md). Secret, lease and time budget: src/lib/cron.ts.
import { runCron } from '@/src/lib/cron'
import { runHalalCron } from '@/src/lib/halal'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = (r: Request) => runCron(r, 'halal', ({ deadline }) => runHalalCron({ deadline }))
