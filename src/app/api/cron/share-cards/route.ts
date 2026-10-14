// Draws ahead the share cards of this week's trending and popular titles (lib/share-cards-cron),
// so the first link shared to one shows its card at once. GitHub runs it twice a day
// (docs/SCHEDULER.md). Secret, lease and time budget: src/lib/cron.ts.
import { runCron } from '@/src/lib/cron'
import { runShareCardsCron } from '@/src/lib/share-cards-cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = (r: Request) => runCron(r, 'share-cards', ({ deadline }) => runShareCardsCron({ deadline }))
