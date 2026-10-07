// Viewer profiles ("Who's watching?"). One account holds up to MAX_PROFILES of them in its user
// document (`users.profiles`); every userContent list carries the `profileId` it belongs to.
// Shared by server and client code, so nothing here may import server-only modules.

export interface Profile {
  id: string        // 24-hex id, unique within the account
  name: string
  color: string     // one of PROFILE_COLORS
  kids: boolean     // Kids profile: catalogue limited to G/PG and kids TV, switching away needs the password
}

export const MAX_PROFILES = 5
export const MAX_PROFILE_NAME = 20

/** Cookie holding the active profile id. httpOnly; always checked against the session user's profiles. */
export const PROFILE_COOKIE = 'tf_profile'

export const PROFILE_COLORS = ['#dc2626', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'] as const

export const isProfileId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value)

/** Trimmed, single-spaced name of 1..MAX_PROFILE_NAME characters, or null when unusable. */
export function cleanProfileName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= MAX_PROFILE_NAME ? name : null
}

/** What the client gets from GET /api/profiles. */
export type ProfilesResponse = {
  /** profiles[0] is the account owner's profile (it shows the account photo when there is one). */
  profiles: Profile[]
  activeId: string | null
  /** No usable profile is selected on this device: show "Who's watching?". */
  needsPick: boolean
  /** Leaving the current state for a grown-up profile needs the account password (see canSwitchFreely). */
  locked: boolean
}
