// GET /api/app/v1/version → the newest Android apps release, so the apps can offer their own update:
// { version, android: { url, size } | null, tv: { url, size } | null }; { version: null } before the first.
import { getAppReleases } from '@/src/lib/app-releases'
import { cached } from '@/src/lib/app-api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  const releases = await getAppReleases()
  const file = (id: 'android' | 'tv') => {
    const found = releases?.apps[id]
    return found ? { url: found.url, size: found.size } : null
  }
  return cached({ version: releases?.version ?? null, android: file('android'), tv: file('tv') }, 600)
}
