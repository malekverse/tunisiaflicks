TRACK shared-lists · WAVE 2 · effort L

Turn single-owner lists (src/lib/lists-db.ts, `lists`) into lists people build together.
- Roles: owner and editor.
- Invites: a link (/lists/[slug]?invite= with InviteBanner) or a friend invite through the ShareSheet.
- Attribution, polling sync and atomic ops.
- Per-list visibility: Only me / Friends / Anyone with the link.
- 'Add to a list' everywhere.
- A list nobody joined behaves exactly as today.

COMMON RULES
- Workspace
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared. Edit only your files.
  - Read ListEditor, the list pages and the library components fully, and keep every behaviour.
- Git (shared index)
  - Stage only your paths; commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On index.lock, retry after 2–10s.
- Design: docs/DESIGN.md, text white/50 or brighter, 44px targets, logical RTL.
- Strings: features/shared-lists.ts (en+ar, tn, fr). Arabic: no verb after {name}; counts as 'label: {count}'.
- Kids: no shared lists.
- Code
  - Run `npx tsc --noEmit --incremental false`; don't touch :3300.
  - Mongo 5.9: findOneAndUpdate returns {value}; claims use modifiedCount.
- Free tiers only.

USE: social libs (requireSocial, getFriends, areFriends, isBlockedEitherWay, avatarPerson), notify, invites, InviteBanner, openShare, ShareActionRow, Avatar, VisibilitySelect (context 'list'), Chip, KidsBlocked (next), Popover.

FILES: see ownership 'shared-lists'. The ProfileLists and AddToListSection stubs are from foundations; keep their signatures. PeekLayer is NOT yours: QuickSheet gets no new action.

DATA (additive)
- List fields
  - ownerProfileId: adopted lazily from profiles[0].
  - visibility 'private'|'friends'|'link'. Missing reads as 'link' (today's behaviour). New lists default to 'private'.
  - members[] {id, userId, profileId, role, joinedAt, lastSeenAt, muted?}, max 8, synthesized when missing. ensureMembers backfills and sets items[].by.
  - pending[] max 10, pruned after 30 days.
  - activity[] $slice −40.
  - version.
  - items[].by.
- Indexes: members.profileId/updatedAt, pending.profileId.
- Limits: 50 owned, 50 joined, 100 items (guard 'items.99' not existing).
- Concurrency
  - Atomic updates with authorization in the filter.
  - Moves use version compare-and-set, 4 attempts, then 409 with the fresh list.
  - Transfer uses arrayFilters.

ACCESS
- resolveAccess(list, viewer) → owner | editor | viewer | none.
- private: members only.
- friends: members plus the owner's friends, blocks respected.
- link: anyone with the slug.
- Blocked either way with the owner → none.
- none → 404 everywhere: GET API, page and OG.
- Kids
  - 403 'kids' on join, invite, collaborators, seen and shared PATCH.
  - Kids GET /api/lists returns only lists whose ownerProfileId is the active Kids profile.

APIs
- GET /api/lists: {lists (owned + member; members ≤4, memberCount, unread), invitations, kids}. Params ?editable=1&contains=.
- POST /api/lists: private by default. 30/h.
- GET /api/lists/[slug]?v=N
  - Projection includes visibility, members and ownerProfileId.
  - Run resolveAccess BEFORE answering 204.
- PATCH (one op per request): title, description, add, remove, move, order, visibility (owner only).
  - Widening visibility notifies the editors (list_update 'visibility').
  - 600/h.
- DELETE: owner only.
- /collaborators
  - GET.
  - POST {handles}: owner, friends only, blocks checked → pending + list_invite.
  - POST {token}: consumeInvite('list'), maxUses 8. isBlockedEitherWay against the owner and every member. Join as editor. Notify the owner list_update 'joined', key `list_join:${slug}:${profileId}`, not coalesced.
  - POST {accept} / {decline}.
  - POST {invite:'link'}: createInvite 30 days, maxUses 8, replace → {url, expiresAt, uses, maxUses}.
  - DELETE {invite:'link'}: revoke.
  - DELETE ?member=: leave or remove.
  - PATCH: role owner, or muted.
- POST /seen.
- Notifications
  - list_update is coalesced per list and recipient in 3h buckets, key `list_update:${slug}:${profileId}:${bucket}`.
  - Skipped when muted or seen within 2 minutes.

UX
1. /lists
- Sections 'Yours' and 'Shared with you'. ListsFilter chips appear only when sharing exists.
- InvitationsStrip: Join (white) / Decline (ghost, h-11, Undo 5s).
- ListCover: AvatarStack pill, red unread dot, '{count} new'.
- Refresh on visibilitychange, throttled to 30s.
2. /lists/[slug]
- Header: AvatarStack + PeopleNames (Intl.ListFormat, bdi), which opens ListPeopleSheet.
- Owner 'Invite'
  - POST {invite:'link'} → openShare({kind:'invite', target:'list', url, title, text: 'Join my list “{title}” on TunisiaFlicks', sendTo:{endpoint: collaborators, body:{}}}).
- Role bar sentence
  - private solo: 'Only you can see this list.'
  - private shared: 'Only the people in this list can see it.'
  - friends: 'Your friends can see it. Only people in the list can edit.'
  - link: 'Anyone with the link can see it. Only people in the list can edit.'
  - Then 'Change'.
- ?invite=
  - InviteBanner 'Invitation from {name} to build “{title}”', accept 'Join as editor'.
  - Consent line: 'Everyone in this list can add, remove and reorder titles, and sees your name next to what you add.'
  - Invalid token → nothing.
- Shared lists
  - AddedBy line, new dot, held remote updates, LiveActivityLine, RecentChanges with 'Put back', Undo on remove.
- ListPeopleSheet (Dialog sm+, Drawer)
  - People with roles; Make owner, Remove.
  - VisibilitySelect context list (solo flag).
  - Invite link use count and 'Turn off link'.
  - Mute; Leave.
- Confirm dialogs, Cancel focused first.
- Non-members (link or friends lists)
  - The grid, plus 'A list by {owner}': the owner's name only, never editors.
- metadata: noIndex for every list page.
- OG: renderFallbackCard unless visibility is 'link'.
- Polling (use-list-sync)
  - Only for multi-member lists or lists with pending invites, and only in a visible tab.
  - 6s, then 20s, then 60s; stop after 30 minutes idle.
3. Add to a list (one picker family)
- AddToListSection (replaces the stub)
  - A ShareActionRow ListPlus that expands into AddToListPicker (useMyLists editable&contains).
  - Rows: cover, title, stack, check, plus 'New list…'.
  - PATCH add, toast 'Added to {list}', then onDone.
  - Null for guests and Kids.
- AddToListDrawer (Drawer, or Dialog on desktop)
  - Opened from MediaActions 'Add to a list…' (ListPlus) after 'Add to bookmarks', in both menus; hidden for guests and Kids.
  - Also opened from the use-library-toggle 'Saved for later' toast action.
  - Opens only after the menu closes.
4. ProfileLists({owner, viewer, view, linkAccess}) (replaces the stub)
- owner view: all lists, with 'Only you' markers.
- public view: lists by ownerProfileId that are 'friends' (viewer is a friend) or 'link' (friend or linkAccess). Never private.
- SectionHeader 'Lists' with ListCover tiles.

queries.ts: getPublicListsOf, getMemberLists, getSharedListDigest. Digest provider: sharedListsDigestProvider.

Lifecycle
- onAccountDeleted(userId): hand each owned shared list to the longest-standing editor, delete solo lists, pull memberships. It runs BEFORE the generic delete.
- onProfileRemovedFromLists(userId, profileId).
- exportMemberships: only your own items and role, no other ids.

SHARED-FILE REQUESTS
- account.ts: ordered pipeline; remove 'lists' from USER_COLLECTIONS.
- profiles/[id].
- Digest providers; legal; README.

ACCEPTANCE
1. Smoke
- No auth → 401.
- Random slug → 404, neutral.
- Garbage token → 404 or 410.
- 'friends' list as a non-friend → 404, also via ?v=.
2. Concurrency script (scripts/shared-lists-concurrency.mjs, with test accounts it creates)
- 40 parallel adds.
- 101 adds, capped at 100.
- 20 moves still form a permutation.
- Transfer works.
- Old docs read as 'link'.
3. Two browsers: a change shows within 6s; reorder is held while dragging.
4. Add to a list works from the ShareSheet, both menus and the save toast. Never two sheets at once.
5. Kids never see shared lists or other profiles' lists.
6. A non-member sees only the owner's name.