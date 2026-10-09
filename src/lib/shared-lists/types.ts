// What the lists API sends to the browser (safe to import on the client). People are named by
// opaque keys that only mean something inside one list: no account or profile ids leave the server.
import type { AvatarPerson } from '@/src/lib/social/types'
import type { ListAccess, ListRole, ListVisibility } from './rules'

export type { ListAccess, ListRole, ListVisibility }

export type ListActivityKind = 'add' | 'remove' | 'move' | 'title' | 'description' | 'visibility' | 'join' | 'leave' | 'owner'

export type SharedListItem = {
  id: string
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  /** Who added it (a key of `people`), on lists with more than one person. */
  by?: string | null
  addedAt?: string
}

export type SharedListMember = {
  /** The member's key (also a key of `people`). */
  id: string
  role: ListRole
  you: boolean
  muted?: boolean
  joinedAt: string
}

export type SharedListActivity = {
  id: string
  at: string
  kind: ListActivityKind
  /** A key of `people`, or null when we don't know who any more. */
  by: string | null
  item?: { id: string; media_type: 'movie' | 'tv'; title: string; poster_path: string | null } | null
  /** move: the new position (0-based). */
  to?: number
  /** title / description / visibility: the new value. */
  value?: string
}

/** One list as its page shows it. Non-members get the items and the owner's name, nothing about the others. */
export type SharedListView = {
  slug: string
  title: string
  description: string
  ownerName: string
  items: SharedListItem[]
  createdAt: string
  updatedAt: string
  visibility: ListVisibility
  version: number
  role: ListAccess
  /** Members only: who is in the list (the owner first). */
  members: SharedListMember[]
  memberCount: number
  /** Members only: invitations by name still waiting for an answer. */
  pendingCount: number
  /** Members only: what each person key looks like. */
  people: Record<string, AvatarPerson>
  /** My key (members only). */
  you: string | null
  /** When I last looked at the list, before this visit (members only). */
  seenAt: string | null
  /** Members only: the latest changes, newest first. */
  activity: SharedListActivity[]
}

/** A list on /lists and in "Add to a list". */
export type MyListSummary = {
  slug: string
  title: string
  posters: (string | null)[]
  count: number
  updatedAt: string
  role: ListRole
  visibility: ListVisibility
  /** Up to four people (the owner first). */
  members: AvatarPerson[]
  memberCount: number
  /** Titles someone else added since I last looked. */
  unread: number
  /** With ?contains=: whether that title is already in the list. */
  contains?: boolean
}

/** An invitation by name waiting on /lists. */
export type ListInvitation = {
  slug: string
  title: string
  posters: (string | null)[]
  count: number
  inviter: AvatarPerson | null
  at: string
}

export type MyListsResponse = { lists: MyListSummary[]; invitations: ListInvitation[]; kids: boolean }

/** The people sheet's extra data (GET /api/lists/[slug]/collaborators). */
export type ListCollaborators = {
  role: ListAccess
  visibility: ListVisibility
  members: SharedListMember[]
  people: Record<string, AvatarPerson>
  /** Owner only: friends invited by name who haven't answered. */
  pending: { person: AvatarPerson; at: string }[]
  /** Owner only: the current invitation link. */
  invite: { active: boolean; uses: number; maxUses: number; expiresAt: string | null } | null
}
