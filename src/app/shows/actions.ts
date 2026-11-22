'use server'

import { getLocale } from '@/src/lib/i18n/server'
import { getActiveProfile } from '@/src/lib/profiles'
import { getTrackedShows, type TrackedShow } from '@/src/lib/tracker-server'
import { withTimeout } from '@/src/lib/with-timeout'

/**
 * For the home page's "New episodes" row: your shows with a new episode out lately that you're
 * nearly caught up on. Empty for guests.
 */
export async function getNewEpisodes(): Promise<TrackedShow[]> {
  const active = await getActiveProfile()
  if (!active?.profile) return []
  const shows = await withTimeout(getTrackedShows({ userId: active.userId, profileId: active.profile.id }, getLocale()), 8000, [] as TrackedShow[]).catch(() => [] as TrackedShow[])
  return shows.filter((show) => show.progress.fresh).slice(0, 12)
}
