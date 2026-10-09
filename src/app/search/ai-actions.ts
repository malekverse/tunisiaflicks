'use server'

import { aiSearchEnabled } from '@/src/lib/ai-search/config'

/**
 * Whether Ask exists on this site (a Groq key is set and it isn't turned off). The search palette
 * asks once per page load (memoized there); whether this viewer may use it (not a Kids profile,
 * not TV mode) is decided in the browser, so switching profiles takes effect at once.
 */
export async function aiSearchStatus(): Promise<{ enabled: boolean }> {
  return { enabled: aiSearchEnabled() }
}
