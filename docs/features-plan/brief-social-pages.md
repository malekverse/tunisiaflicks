TRACK social-pages · WAVE 2 · effort L. You build the social pages on social's wave-1 foundations:
- /friends and /friends/list
- /u/[handle] with its OG image
- /me
- /notifications
- the Settings #privacy body (SocialPrivacySettings stub, already mounted)
- the friends digest provider
Read first: src/lib/social/**, src/components/social/** (including ProfileSetupCard), inbox/**, share/**, notify.ts, invites.ts and api/social/**. You may fix bugs there without changing exported signatures.

COMMON RULES
- Workspace and git
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared with 8 agents.
  - Edit only your files.
  - Shared index: stage only your paths; commit with `git commit -m 'msg' -- <paths>`. Never a bare commit, add -A, stash or reset. On index.lock, retry after 2–10s.
- Design: follow docs/DESIGN.md.
  - Logical RTL. 44px targets.
  - Text white/50 or brighter. Red only for unread and primary.
  - A button on a link card is a sibling, never nested.
- Strings: features/social.ts (en+ar, tn, fr).
  - In ar/tn, no verb directly after {name}; use noun forms: 'المشاهدات خاصة', 'الحلقة 3 من الموسم 2: {name}'.
  - Derja: صحابي.
  - The surface is 'Your page' / 'صفحتك' / 'Votre page'.
- Client imports: from i18n/locales.
- Kids get KidsBlocked what='social' with next=<path+search>. Guests get SignInInvite with a title, text and callbackUrl.
- Tooling
  - `npx tsc --noEmit --incremental false`. Don't touch the :3300 server.
  - next/og: use the plain-Node harness.
  - Tests: tests/social-pages.test.mjs (BASE_URL).
- Free tiers only.

All pages are force-dynamic and noIndex.

1. /friends
- PageHeader 'Friends', 'What your friends are watching.' End slot: SegmentedLinks Activity | Your friends.
  - The list tab shows a red dot only for unread friend_request notifications; otherwise a neutral white/15 count of pending requests.
- States
  - Guest: SignInInvite (UsersRound).
  - Kids: KidsBlocked.
  - No handle: ProfileSetupCard.
  - No friends: EmptyState 'Better with friends', action [Add a friend] → /friends/list#add.
  - Friends but nothing shared: 'Nothing new from friends'.
- Feed
  - Day groups Today / Yesterday / This week / Earlier, built from item.day. Never show a time.
  - Panels with dividers.
  - Sentinel with rootMargin 600px, plus a 'Load more' button.
  - Data: GET /api/social/feed.
- ActivityRow (<article>)
  - Poster 64/76 linking to mediaHref.
  - richT sentence in noun form; the name links to /u/handle.
  - Read-only stars.
  - Save toggle (useLibraryToggle).
  - aria-label is one full sentence.
- Room light
  - Changes only after a row has stayed centred (IntersectionObserver rootMargin '-45% 0px -45% 0px') for at least 600ms with scrolling stopped.
  - Load the ambient colour only for that row.
  - Under reduced motion, tint once from the newest item.
- Privacy nudge when your activity is private: slim glass card [Share with friends → /profile#privacy] with a sibling X (localStorage).

2. /friends/list
- Requests (#requests)
  - Incoming: Accept (primary) / Decline (ghost), h-11 on touch with a gap of at least 8px.
  - Decline shows an Undo toast and sends PATCH after 5s.
  - Outgoing: 'Requested' + Cancel.
- Friends ({count})
  - PersonRow: avatar 40, name, @handle.
  - Row menu: Remove, Block, each behind a confirm dialog with Cancel focused first. Both are silent.
- Add a friend (#add)
  - Exact-handle input: '@' adornment, dir=ltr, 16px, autocapitalize off. Shows the person and [Add friend], or 'Not found'.
  - Invite card (ShareLinkRow), from POST /api/social/invite:
    - 'Works until {date}' and 'Used {uses} of {maxUses}'
    - [Share link] → openShare invite mode with target 'friend' (QR, no People row)
    - [Turn off link] → DELETE
    - [New link]
- Accepting
  - AnimatePresence exit (tween.fast); layout spring.ui.
  - Toast 'You and Amine are friends' (ar 'صداقة جديدة مع {name}'); haptic(10).

3. /u/[handle]
- Routing
  - Lowercase the handle. resolveHandle: redirectTo → 308.
  - notFound() when unknown, blocked either way, or the profile is Kids.
  - Guests: rate limit 60 views per 10 minutes per IP (/64 for IPv6). Over the limit, every handle renders the same not-found.
- Link access: `?k=` → shareKeyMatches → linkAccess. Never echo k into links. Share profile uses the keyed URL.
- Invite (?invite=, readInvite('friend') with targetId = this profile, viewer isn't the owner)
  - InviteBanner: sentence 'Invitation from {name}' style ('Amine invited you to be friends' in en; noun form in ar), accept {endpoint:'/api/social/requests', body:{}}, consent copy.
  - Expired or used up → unavailable.
  - The banner itself handles needs_handle.
- Header
  - UserAvatar 96, 128 from md.
  - Name: font-display clamp(34px,5vw,64px), dir=auto. @handle in white/55 inside an LTR bdi.
  - 'Friends since {month year}' for friends. Bio (60ch, plain text).
  - `<ProfileBadges owner view/>`; in public view only when canSee(viewer, owner, 'badges', {shareKey}).
  - Actions
    - Visitors: relationship button (Add friend / Requested / Accept+Decline / Friends menu with Remove and Block) and Share profile (keyed URL).
    - Owner: Edit → /profile#privacy, and Share.
  - Never show friend counts.
- Sections
  - Recently watched (canSee activity): Row of PosterCards with chips such as 'S2 finale'.
  - Ratings (canSee ratings): getRecentRatings, newest 30.
  - Lists: `<ProfileLists owner viewer view linkAccess/>`.
  - Owner sees everything, with an 'Only you' Lock marker.
  - Private states are calm Lock panels using noun-form copy.
- Room light: most recent visible poster, else the avatar colour.
- opengraph-image: renderProfileCard (name, handle, colour, initial, image only), revalidate 300. Never posters, never activity.

4. /me
- With a handle: 302 to /u/[handle].
- Without a handle:
  - ProfileBadges (owner view)
  - 'Your year' card → /wrapped (framed card in the profile colour)
  - ProfileLists (owner)
  - ProfileSetupCard
- Kids: ProfileBadges and the Your year card only.
- Guest: SignInInvite (UserRound).

5. /notifications
- PageHeader. ChipGroup single: All / Friends / Alerts / Movie nights, mapped through NOTIFICATION_FILTERS.
- InboxList with the before cursor; marks visible items read. digestHint as in social.
- Kids: chips hidden.

6. #privacy: SocialPrivacySettings (replaces the stub)
- `<SettingsSection id='privacy' title='Friends and privacy' description='For this profile.'>`
- No handle: ProfileSetupCard.
- With a handle, a SettingsGroup:
  - Handle (changeable once per 30 days, with an 'available again on' hint), name, bio, and 'Use my account photo' (owner profile only).
  - Visibility rows (VisibilitySelect context 'profile'):
    - What I watch: options private and friends only. Hint 'Friends see the day you watched, a couple of hours later, and only from the moment you turn this on.'
    - My ratings: 3 options. Hint 'Friends see ratings from now on.' plus an 'Also share my past ratings' button (confirm).
    - My badges: 3 options.
  - 'Your page link' row: copy the keyed URL, and Reset link.
  - `<BadgesSetting/>` (badges' component).
  - Friend requests from: Anyone with my handle or link / Nobody.
  - Pause sharing.
  - Blocked people with Unblock.
  - Danger zone: 'Delete my page' ('Removes your handle, friends and requests. Your ratings stay, private.').
- Saves on change; toast only on error.

7. Digest provider (src/lib/social/digest.ts): friendsDigestProvider 'Your friends this week', up to 5 rows from getFriendsActivity.

SHARED-FILE REQUESTS
- nav YOURS: Friends (integration).
- Digest provider registration.
- README.

ACCEPTANCE
1. Guest: /friends, /friends/list, /me and /notifications return 200 with SignInInvite. /u/does-not-exist returns 404. All pages carry noindex.
2. Two accounts
   - Setup.
   - The invite flow, including a signed-out user going through Google sign-in and the profile picker, then handle setup inside the banner.
   - Request, accept, decline with undo, cancel.
   - Block returns 404 in both directions.
   - Activity appears only after it is set to Friends and only for later watches (delay 0 in dev).
   - 'link' sections show only with ?k=. Reset link invalidates the old key.
3. Kids see KidsBlocked; /me shows badges and Your year.
4. RTL, 375px, keyboard; feed rows read as sentences.
5. The /u OG image has no posters and no activity.