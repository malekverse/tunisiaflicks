// The Tunisian TV job: cron-job.org every 30 minutes (Africa/Tunis), GitHub at '23 */3 * * *' as
// the fallback (see docs/SCHEDULER.md). Secret, lease and time budget: src/lib/cron.ts. The work:
// src/lib/tunisian-tv/ingest.ts. ?scope=feeds reads only the feeds; ?scope=full rereads every
// channel, playlists included (the default reads what is due).
import { runCron } from '@/src/lib/cron'
import { runTunisianTvIngest, type IngestScope } from '@/src/lib/tunisian-tv/ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = (r: Request) => runCron(r, 'tunisian-tv', ({ deadline }) => {
  const asked = new URL(r.url).searchParams.get('scope')
  const scope: IngestScope | undefined = asked === 'feeds' || asked === 'full' ? asked : undefined
  return runTunisianTvIngest({ deadline, scope })
})
