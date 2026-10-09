TRACK social · WAVE 1 · effort XL. You build the foundations 8 other tracks import:
- the shell (nav and inbox)
- the social graph and its safety rules
- ratings, invites and notify()
- the ShareSheet, the profile setup card and the social UI pieces
social-pages (wave 2) builds /friends, /u, /me, /notifications and #privacy. Don't build those.
Foundations already wrote src/lib/social/types.ts (frozen), created and mounted the stubs ShareSheetHost and FriendsRow, added `kids`/`seasonal`/`ask` props to Rail, TabBar and TopBar, and wired SettingsNav.

COMMON RULES
- Workspace and git
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign).
  - Edit only your files; report other changes. The git index is shared: stage only your paths and commit with a pathspec (`git commit -m 'msg' -- <paths>`). Never a bare commit, add -A, stash, reset or checkout. On index.lock, retry after 2–10s, up to 10 times; never delete the lock.
- Design
  - Follow docs/DESIGN.md: true black, red only as signal or unread, glass chrome, panels rounded-[22px] bg-white/[0.04] ring-1 ring-white/[0.07].
  - Logical RTL utilities; overlap with `[&>*+*]:-ms-2`. 44px targets. Text at least white/50. No all-caps, '·', '→' or emoji.
  - A button on a link card is a sibling, not nested.
- Strings: src/lib/i18n/features/social.ts (en+ar complete, tn where Derja differs, fr).
  - Arabic and Derja: no verb after {name}; use noun forms ('من {name}: {title}', 'طلب صداقة من {name}').
  - French: 'Invitation de {name}'.
- Code
  - Client files import from i18n/locales and translate, never values from '@/src/lib/i18n'. No `locale === 'en'`, no exhaustive Record<Locale>.
  - `npx tsc --noEmit --incremental false`, judged on your own files only. Don't touch the dev server on :3300.
  - Tests: tests/social.test.mjs (BASE_URL, default :3000) and tests/social.unit.test.mjs (pure).
  - Mongo 5.9: findOneAndUpdate returns {value}; claims check modifiedCount.
  - next/og on Windows: use the plain-Node harness. No new deps (uqr and popover are installed).

IDENTITY MODEL
- ProfileRef {userId, profileId}. Every grown-up profile may claim one handle.
- Handles
  - Must match HANDLE_RE and be unique.
  - Reserved words: me, u, admin, support, settings, friends, notifications, api, tunisiaflicks, official, staff, moderator, help, about, login, signup, profile, profiles, lists, movie, tv, search, inbox, app, activate.
  - Reserved substrings in handles and display names: tunisiaflicks, admin, support, official, staff, moderator. Check after NFKC and folding 0→o, 1→l, 3→e, 4→a, 5→s, 7→t.
  - Collection `handles` {_id: handle, profileId, userId, current, changedAt?, until?}. After a change, the old handle redirects (308) for 30 days and stays reserved for 90.
- Who may act
  - Kids: 403 {code:'kids'}.
  - Writes (claim, request, send, invite, token join) need a verified e-mail: 403 {code:'unverified'}.
  - Limited (TV) sessions: 403 {code:'tv_session'}.
- Friendship
  - Mutual. No directory: find people by exact handle or link only.
  - Privacy defaults to all private.
  - Not a chat: notes are 140 chars or less, with no threads and no receipts.
- Naming: the social surface is 'Your page' ('صفحتك', 'Votre page'); the settings section is 'Friends and privacy'.

A. SHELL (read Rail, TabBar, MenuSheet, AccountMenu, TopBar and nav fully; keep every behaviour)
1. nav.tsx
- NavItem gains match, grownUp, kidsHref and kidsAlt.
- isItemActive, plus activeHref (the longest match wins).
- visibleItems(items, kids): for Kids, kidsAlt replaces the item, grownUp items are dropped, and kidsHref swaps the href.
- Groups:
  - BROWSE: Home, TV Shows, Discover, Clips, Coming Soon, Top Rated, Surprise me (Dices, plain).
  - WORLD: Tunisian (TunisiaIcon, kidsHref '/tunisian/cinema').
  - LIBRARY: saved first, then favorites, history, lists.
  - YOURS (transition): Swipe (HeartHandshake); Library {href:'/saved', label:'nav.library', icon: Library, match:['/favorites','/history','/lists']}; My Year.
  - TABS: unchanged.
- Delete EXTRAS.
- `import type {SeasonalNav, SeasonalIconKey} from '@/src/lib/seasons'`; SEASONAL_ICONS.
2. Rail
- kids falls back to useProfiles().
- Groups BROWSE | WORLD + seasonal | YOURS, with Settings pinned.
- Hide signedInOnly seasonal items for guests. White icons; the only colour is the red active indicator. Labels ≤20 chars.
3. TabBar
- The 'You' tab shows the active pill when no TABS item matches (except /profiles, /login, /signup, /auth/*).
4. MenuSheet, in order:
  1. Account row, with a second line 'Your page' → /me.
  2. Profile switcher.
  3. Together tiles, rounded-[22px] h-[84px], hidden for Kids.
     - Friends tile: GET /api/social/friends?summary=1, an AvatarStack, a red dot only when unreadRequests > 0, and otherwise a neutral white/15 count of pendingIncoming. Rendered only when YOURS has '/friends'.
     - NightTile stub: only when YOURS has '/movie-night'.
  4. Places grid: TV Shows, Tunisian, rest of WORLD, Coming Soon, Top Rated, Surprise, seasonal. Applies visibleItems; no static /ramadan.
  5. Library.
  6. LanguageSwitch stretch.
  7. 'Switch to TV mode' <a href='/?tv=1'> when useLikelyTv().
  8. Log out.
5. AccountMenu
- The header label stays a label. First item: a real DropdownMenuItem 'Your page' (UserRound) → /me.
- Then: Switch profile, Manage profiles, Favorites, Bookmarked, TV mode (useLikelyTv), Settings, separator, Log out.
6. TopBar
- The bell is InboxBell. The pill label stays search.open; integration switches it to the ask label later.

B. DATA (native driver, lazy indexes)
- socialProfiles {_id: profileId, userId, handle, name, bio, usePhoto, color, privacy, shareKey, activitySince, ratingsVisibleSince, handleChangedAt?, createdAt, updatedAt}
  - name 1–40 chars and bio ≤160, with control, bidi and URLs stripped.
  - usePhoto is allowed only on the account's owner profile, profiles[0].
  - shareKey: 16 random bytes, base64url, rotatable.
  - Indexes: handle unique, userId.
- friendships {_id, pair (unique), profiles, users, status 'pending'|'accepted'|'declined', requestedBy, via, createdAt, acceptedAt?, lastActivityAt?, expiresAt?}
  - Pending and declined rows expire after 90 days (TTL).
  - Index {profiles:1, status:1}.
  - Declined is a tombstone: requests from any profile of that account to that profile are swallowed silently.
  - A request in the opposite direction auto-accepts.
  - Caps: 500 friends, 50 pending outgoing.
- blocks {blockerProfileId, blockerUserId, blockedProfileId, blockedUserId, createdAt}
  - Unique on the profile pair; index on the user pair.
  - A block deletes the direct friendship.
- invites: see the contracts. Friend invite: 14 days, maxUses 10, replaces the previous one.
- ratings {userId, profileId, media_type, tmdbId, stars, title, poster_path (server-resolved), kids, accountVerified, ratedAt, updatedAt}
  - Indexes: unique {profileId, media_type, tmdbId}; {media_type, tmdbId}; {profileId, updatedAt:-1}.
- notifications
  - New fields: profileId (null = account-wide release), href, text, actor, actors (≤3), actorCount, media, image, note, action, merge_key, kidsVisible.
  - notify() always sets event_key = `${kind}:${to.profileId}:${key}`. This fits the existing unique {userId, event_key}.
  - New index {userId, profileId, merge_key}, partial on read:false.
  - Social items get email_status 'none'.
  - release-alerts (digest) adds kidSafe.
- pushSubscriptions.profileId

C. LIBRARIES (exact signatures in the contracts)
- session.ts
  - requireSocial checks, in order: 401 → tv_session (denyLimitedSession) → needs_pick → kids → unverified (write) → needs_handle.
- identity.ts
  - image is `/api/social/avatar/<handle>?v=<first 8 hex of sha256(users.image)>`, only when usePhoto is on and the profile is the owner profile.
- media.ts
  - resolveShareMedia validates the id (/^[0-9]{1,9}$/) and the type enum, then calls tmdbFetchSafe(`${type}/${id}`, {language}, 86400).
  - mediaHref returns `/${type}/${id}`.
  - Anything shown to another person comes from here, never from stored client text.
- friends.ts
  - isBlockedEitherWay checks the profile pair OR the account pair, either direction.
  - getFriends filters blocks.
- privacy.ts
  - canSee: owner true; blocked false; paused false.
  - 'link' means friends OR the shareKey matches; 'friends' means areFriends; 'private' false.
  - activity is never 'link'.
- ratings.ts
  - setRating resolves the title through TMDB (404 if missing) and stores kids and accountVerified.
  - ratingSummary: unstable_cache, revalidate 86400, tag `rating:${type}:${id}`. Counts only kids:false, accountVerified, updatedAt ≤ now−24h, the latest rating per userId, and needs at least 20 accounts. Average rounded to 0.5; countLabel '20+' | '50+' | '100+' | '500+'.
  - friendsRatings and getRecentRatings return only non-Kids ratings that are visible, not paused, with updatedAt ≥ ratingsVisibleSince.
- activity.ts
  - Look at the 50 most recently active friends (lastActivityAt, updated lazily on read).
  - Read their history via $slice −40. Keep watched_at ≥ activitySince and ≤ now − SOCIAL_ACTIVITY_DELAY_MINUTES (120; 0 in development), within 60 days.
  - Merge in visible ratings. One item per friend and title. Media comes from resolveShareMedia.
  - `day` in Africa/Tunis; no time is exposed.
  - classifyEpisode only for the returned page (≤20 calls).
  - getFriendsActivity: unstable_cache 300s per viewer profile (tag `friends:${profileId}`), limit ≤30.
- invites.ts
  - consumeInvite is atomic: updateOne with uses < maxUses, not revoked, not expired, $inc uses, and modifiedCount===1.
- notify.ts
  - Drop the notification when actor and recipient are blocked.
  - Merge only when `merge` is set and there is no note: same profileId, merge_key `${kind}:${media_type}:${tmdbId}`, unread, under 24h.
  - Persist kidsVisible.
  - Push via pushToUser(…, {profileId}). The lock screen never shows a note.
- account.ts
  - Exports map other people's refs to {handle, name} only.
  - deleteSocialData removes the user's socialProfiles, handles, friendships, blocks, invites by owner and ratings. It deletes notifications where actor.userId is the user, and for actors.userId it pulls the user, $inc actorCount −1 and $unset note.
  - deleteSocialProfile does the same per profile, and also unbinds pushSubscriptions (profileId null, friends/nights topics pulled).
  - resetSocialVisibility sets activitySince and ratingsVisibleSince to now.

D. APIs
All are force-dynamic, JSON only, Cache-Control private no-store, errors shaped {error, code}. Rate limits are keyed per userId unless noted.
- /api/social/handle
  - GET ?h=: signed-in grown-ups only. 30 per 10 min per account plus 60 per 10 min per IP (/64 for IPv6). Returns {available, reason, suggestions[3]}.
  - POST (write): claim. At most 2 claims per account per 30 days. 201.
  - PATCH: name, bio, usePhoto (owner profile only, else 403 not_owner_profile), handle (once per 30 days).
- /api/social/privacy
  - GET: {privacy, handle, shareUrl}.
  - PATCH:
    - activity leaving private sets activitySince = now.
    - paused true→false sets activitySince = now.
    - ratings leaving private sets ratingsVisibleSince = now.
    - {resetShareKey:true} rotates the key.
    - {sharePastRatings:true} sets ratingsVisibleSince to the epoch.
- /api/social/friends
  - GET returns friends, incoming, outgoing, blocked. ?summary=1 returns {friends: 3, total, pendingIncoming, unreadRequests}.
  - DELETE ?handle=&block=1 or ?unblock=.
- /api/social/requests
  - POST {handle}: 20 per day per account. A tombstoned request is swallowed (returns 201). 404 when unknown or blocked; 403 requests_off.
  - POST {token}: consumeInvite('friend'), check blocks, create an accepted friendship, and notify the owner friend_accepted.
  - PATCH {id, accept}: declining writes the tombstone and settles the inbox action.
  - DELETE ?id=: cancel.
- /api/social/invite
  - POST (write): {url: `/u/${handle}?invite=${token}`, expiresAt, uses, maxUses}.
  - GET: inviteStatus. DELETE: revoke.
- GET /api/social/feed?before&limit.
- POST /api/social/send (write)
  - Body {to: handles[1..5], media: {media_type, id}, note? ≤140 with URLs and bidi stripped}.
  - Resolves the media; sends to friends only. 30 per day per account, 10 per day per recipient.
  - Notifies title_sent (merge only without a note) with text 'social.inbox.titleSent' and push topic 'friends'.
  - Returns {sent, skipped}.
- GET /api/social/avatar/[handle]?v=&s=
  - Only for usePhoto on the owner profile. Source: a data URL ≤700KB or https://lh3.googleusercontent.com/ only.
  - sharp with limitInputPixels 4096*4096; webp at 64/128/256; EXIF stripped.
  - `public, max-age=3600, s-maxage=86400`. Otherwise 404 with no-store.
- /api/ratings
  - GET {mine, friends, average, countLabel}. Guests get mine null.
  - PUT {type, id, rating} (requireActiveProfile; Kids and TV may rate): {mine, first, hint}.
  - friend_rated for 4 stars and up when ratings are visible to friends: notify friends who have the title saved. Query {profileId: {$in: first 200}, type:'saved', 'items.id': id} using index {type:1, profileId:1}, projection {profileId:1}. Merge, no push.
  - DELETE. Rate limit 120 per hour.
- /api/notifications
  - GET ?limit&before&filter: filter by {userId, profileId: {$in: [null, active]}}.
  - Kids additionally match {$or: [{kind: release, kidSafe: true}, {kidsVisible: true}]}.
  - The filter param uses NOTIFICATION_FILTERS. Rows with a pending action come first.
  - Resolve actors with getIdentities. The unread count uses the same filter.
  - PATCH marks only visible items read.

E. COMPONENTS
1. Avatar
- UserAvatar: a round colour tile with an initial, or the photo.
- AvatarStack: `[&>*+*]:-ms-2`, ring-2 ring-black, '+N'.
- PersonChip: h-8, <bdi>.
2. RatingStars
- A radiogroup with 44px targets and 24px stars (fill-star or white/30). Arrows mirror in RTL; Home, End, Delete.
- haptic(10). Partial fill is anchored at start-0.
- Never red. RatingSummary shows countLabel.
3. RatingsBand
- Rows: Your rating (signed-in, including Kids); Friends who rated (grown-ups; hidden when empty); TunisiaFlicks average when the average isn't null ('From {countLabel} ratings').
- Guests: average plus 'Sign in to rate', or null when there is no average.
- First-rating hint links to /profile#privacy. Copy: 'Friends see ratings from the moment you share them.'
4. VisibilitySelect (context profile|list, options, solo)
- Labels: Only me (or 'Only people in this list' for a shared list) / Friends / Anyone with the link.
- Profile hint: 'Uses your page's private link. Your handle alone doesn't show it.'
- Segmented with a layoutId pill, 44px.
5. FriendPicker: as specified (ring-red check, search above 8 friends, max 5 with a shake).
6. ProfileSetupCard (variant page|inline)
- Handle field with a 350ms debounced availability check (aria-live) and 3 suggestion Chips.
- Name prefilled; bio ≤160 with a counter.
- 'Use my account photo' only on the owner profile when a photo exists.
- Footnote: 'Nothing is shared until you turn it on.'
- Red Create button, disabled until the handle is available. POST, then onCreated (default router.refresh()).
- Unverified e-mail: show the verify line plus ResendVerificationButton instead.
- Completion: avatar from scale .92 with blur 6px (spring.ui); fade only under reduced motion.
7. ShareSheet (Dialog md+, vaul Drawer on phones; ShareSheetHost lazy-loads it)
- Title mode:
  - People row: FriendPicker, a note (16px textarea, counter from 120), and a red Send that POSTs {to, media: {media_type, id}, note}. Success morphs to 'Sent'.
  - PlanNightRow and AddToListSection stubs.
  - External ShareButtons and Copy link.
- Invite mode: People row only when sendTo is set; external links; 'Show QR code' (uqr, dynamically imported, white 240px card).
- Variants:
  - Guests: externals plus a sign-in line.
  - Kids: externals only.
  - No handle: inline ProfileSetupCard.
  - Unverified: verify line.
8. InviteBanner
- Keep the token in state. replaceState strips ?invite= only after a successful accept or decline, or when unavailable.
- 409 needs_handle: render an inline ProfileSetupCard; onCreated, call accept again directly (no refresh).
- 403 unverified: verify line.
- Signed out: /login?callbackUrl=<path?invite=token>.
- consent line.
- Accept: on success, router.refresh() or onAcceptedHref.
9. Inbox
- InboxBell: Popover on lg+ (role=dialog, aria-label alerts.bellLabel, 360px, Escape returns focus to the bell); vaul Drawer below lg with the same list.
  - Unread badge; opening sends PATCH {all:true}, but pending rows stay pinned.
  - Footer: 'See all' → /notifications; 'Manage' → /profile#following when every item is a release kind or the profile is Kids, else /profile#notifications.
  - Refresh on focus. Nothing for guests.
- InboxItem
  - Structure: an <article> with a stretched <a> and the actions as siblings (relative z-10).
  - Leading visual: poster, image or UserAvatar 40.
  - Text: richT line (name and title as bold bdi; 'and {others} others'); line 2 white/60 clamp 2; time white/50 11px (Intl.RelativeTimeFormat); red unread dot.
  - Action buttons: h-11 on coarse pointers and in the Drawer, gap ≥8px; primary plus ghost.
  - Decline and Can't show an Undo toast and send only after 5s.
  - Actions:
    - friend_request → PATCH requests.
    - night_invite → POST /api/movie-night/{id} {action:'rsvp', going}.
    - night_join → POST /api/movie-night/{nightId} {action:'approve', profileId, approve}.
    - list_invite → POST /api/lists/{slug}/collaborators {accept} or {decline}.
  - Release kinds keep today's text.
- InboxList: empty state (Bell, 'You're all caught up'). The digest hint shows only when the digestHint prop is set: InboxBell fetches GET /api/digest once for grown-ups and passes `available && !enabled`.
10. KidsBlocked: what 'social', title, description, next. 'Switch profile' → `/profiles?next=<encoded>`.
11. FriendsRow (replaces the stub)
- 'Friends are watching': withTimeout(getFriendsActivity limit 12, 4000, null).
- Needs ≥3 unique titles, else null. AvatarStack overlay. See all → /friends.
- Null for guests, Kids and people with no friends.

F. WIRING
- MediaActions: replace the Share submenu in MediaContextMenu and MediaOptionsMenu with one 'Share…' (Share2) → openShare({kind:'title', media}).
- PeekLayer: keep the 4 actions. Share closes the QuickSheet, then calls openShare after the close animation (~300ms).
- push.ts
  - PushTopic adds friends and nights.
  - pushToUser(userId, payloadFor(sub) → payload | null, topic, {profileId?, kidSafe?}). kidSafe false skips subscriptions bound to a Kids profile.
- /api/push: stores profileId; drops friends/nights for Kids; rate limit keyed on subscriptionId(endpoint).
- use-push: re-POST only when localStorage 'tf-push-profile' (try/catch) differs from the active profile.
- PushSettings: implement the children slot. Group 'On this device'; for grown-ups, Friends and Movie nights toggles.
- og.tsx: append renderProfileCard({name, handle, color, initial, image}). No posters, no activity.

G. STRINGS (social.*)
- nav, menu.yourPage, kidsBlocked.title
- together.*, share.*, ratings.*
  - stars ar: 'لم يعجبني', 'ليس جيدًا', 'جيد', 'جيد جدًا', 'رائع'
  - stars tn: 'ما عجبنيش', 'موش لهنا', 'باهي', 'باهي برشا', 'يهبّل'
- inbox.*:
  - titleSent: en '{name} sent you {title}', ar 'من {name}: {title}'
  - friendRequest: en '{name} wants to be friends', ar 'طلب صداقة من {name}'
  - friendAccepted: ar 'صديق جديد: {name}'
- push.*, invite.*, setup.*, errors.* (including kidsHasHandle, unverified, tv_session)

SHARED-FILE REQUESTS
- account.ts lines.
- profiles/[id]: deleteSocialProfile; PATCH kids=true with a handle → 400; resetSocialVisibility on any kids change.
- legal: social paragraph.
- README: SOCIAL_ACTIVITY_DELAY_MINUTES.

ACCEPTANCE
1. Nav
- tsc is clean; the rail groups match; EXTRAS is gone.
- Kids: no grown-up items, Tunisian → /tunisian/cinema, no Together tiles.
- On /dramas the 'You' tab is active.
2. Guest: feed 401, PUT ratings 401, GET ratings 200 with mine null, notifications 401.
3. Two accounts (verified)
- Claim handles; reserved substrings are rejected.
- Invite flow: the use count rises and the owner gets friend_accepted.
- Sends with notes don't merge; note-less sends do.
- Block: B's other profile can't request A.
- A declined request is silently swallowed on retry.
- An unverified account gets 403 unverified.
4. Ratings
- Keyboard and RTL work.
- Private until shared; past ratings stay hidden after sharing until 'share past' is used.
- No average below 20 accounts. Kids ratings never show to friends.
5. ShareSheet: variants, QR code, and only one sheet open from the QuickSheet.
6. Bell
- Tab reaches Accept/Decline in the popover; Escape returns focus.
- Kids bell: kidSafe release items and kidsVisible items only.
- Social items stay email_status 'none'.
7. Unit tests: eventKey and merge eligibility, handle validation and folding, the canSee matrix with injected relations, isBlockedEitherWay over account pairs (stubbed DB).
8. AvatarStack overlap is correct in RTL.