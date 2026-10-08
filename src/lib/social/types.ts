// The social layer's shared vocabulary (frozen contract): who a person is, what they share and
// with whom, and the kinds of things the inbox shows. Pure types and constants, safe to import on
// the client. Changing a signature here needs a report to the lead (other tracks code against it).

/** One viewer profile of one account: every social object belongs to one. */
export type ProfileRef = { userId: string; profileId: string }

/** What it takes to draw someone's avatar (a colour tile with an initial, or their photo). */
export type AvatarPerson = { name: string; color: string; image?: string | null; handle?: string | null }

/** Someone with a profile page (/u/[handle]). */
export type PublicIdentity = AvatarPerson & { handle: string }

/** link = friends OR whoever holds the shareKey (profiles) / slug (lists). */
export type Visibility = 'private' | 'friends' | 'link'

export type PrivacySettings = {
  activity: 'private' | 'friends'
  ratings: Visibility
  badges: Visibility
  requests: 'anyone' | 'nobody'
  paused: boolean
}

/** Nothing is shared until the person chooses to; friend requests come from anyone who has the handle or a link. */
export const DEFAULT_PRIVACY: PrivacySettings = {
  activity: 'private',
  ratings: 'private',
  badges: 'private',
  requests: 'anyone',
  paused: false,
}

export type Relationship = 'self' | 'friends' | 'outgoing' | 'incoming' | 'blocked' | 'none'

export const HANDLE_RE: RegExp = /^[a-z0-9_]{3,20}$/

/** Handles nobody may claim (route names and words that would impersonate the site). */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'me', 'u', 'admin', 'support', 'settings', 'friends', 'notifications', 'api', 'tunisiaflicks',
  'official', 'staff', 'moderator', 'help', 'about', 'login', 'signup', 'profile', 'profiles',
  'lists', 'movie', 'tv', 'search', 'inbox', 'app', 'activate',
])

/** Not allowed anywhere inside a handle or a display name (checked after NFKC and digit folding). */
export const RESERVED_SUBSTRINGS: readonly string[] = ['tunisiaflicks', 'admin', 'support', 'official', 'staff', 'moderator']

/** A title as shown to people (display only); APIs take {media_type, id}. */
export type ShareMedia = { media_type: 'movie' | 'tv'; id: string; title: string; poster_path: string | null }
export type MediaRef = { media_type: 'movie' | 'tv'; id: string }

export type NotificationKind =
  | 'movie_released' | 'new_episode'
  | 'friend_request' | 'friend_accepted' | 'title_sent' | 'friend_rated'
  | 'night_invite' | 'night_update' | 'night_reminder'
  | 'list_invite' | 'list_update'
  | 'badge_earned'

export type InboxActionType = 'friend_request' | 'night_invite' | 'night_join' | 'list_invite'

/** An inline action on an inbox row. For night_join, id = `${nightId}:${profileId}`. */
export type InboxAction = { type: InboxActionType; state: 'pending' | 'accepted' | 'declined'; id: string }

/** The inbox filters (/notifications chips, GET /api/notifications?filter=). */
export const NOTIFICATION_FILTERS: Record<'friends' | 'nights' | 'alerts', NotificationKind[]> = {
  friends: ['friend_request', 'friend_accepted', 'title_sent', 'friend_rated', 'list_invite', 'list_update'],
  nights: ['night_invite', 'night_update', 'night_reminder'],
  alerts: ['movie_released', 'new_episode', 'badge_earned'],
}
