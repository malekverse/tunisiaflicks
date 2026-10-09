// The other features' digest sections, in the order they appear in the e-mail. Each provider
// module imports only types from ./providers, so there is no import cycle at runtime.
import type { DigestProvider } from '@/src/lib/digest/providers'
import { friendsDigestProvider } from '@/src/lib/social/digest'
import { nightsDigestProvider } from '@/src/lib/movie-night-digest'
import { sharedListsDigestProvider } from '@/src/lib/shared-lists/queries'
import { tunisianTvDigestProvider } from '@/src/lib/tunisian-tv/digest'
import { badgesDigestProvider } from '@/src/lib/badges/digest'

export const DIGEST_PROVIDERS: DigestProvider[] = [
  friendsDigestProvider,
  nightsDigestProvider,
  sharedListsDigestProvider,
  tunisianTvDigestProvider,
  badgesDigestProvider,
]
