TRACK movie-night · WAVE 2 · effort L

Plan a movie night with friends: a date, guests who RSVP and film candidates. 'Pick together' seeds a linked Swipe room, and its match becomes the film.
- No voting, no /together, no accountless guests.
- Kids: KidsBlocked what='social'. In the nav, Kids keep Swipe through kidsAlt (integration).

COMMON RULES
- Workspace
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared.
  - Edit only your files.
- Git (shared index)
  - Stage only your paths; commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On index.lock, retry after 2–10s.
- Design: docs/DESIGN.md. Text ≥ white/50; 44px targets; siblings, not nested buttons.
- Strings: features/movie-night.ts (en+ar, tn, fr).
  - In ar/tn, no verb after {name}: 'دعوة إلى سهرة فيلم من {name}'.
- Dates: Intl with dateLocale; times h23.
- Code and tests
  - Run `npx tsc --noEmit --incremental false`; leave :3300 alone.
  - next/og: patched harness.
  - Mongo 5.9: {value}; use modifiedCount for claims.
  - Tests: tests/movie-night.test.mjs (BASE_URL), tests/movie-night.unit.test.mts.
- Free tiers only.

USE: social libs, notify, invites (consumeInvite, inviteStatus), InviteBanner, openShare, ShareActionRow, Avatar, FriendPicker, KidsBlocked (with next), Chip, cron.ts runCron, withTimeout.

FILES: ownership 'movie-night'. Stubs from foundations: NightTile, PlanNightRow, UpcomingNightCard (mounted on home slot 5). Keep their signatures.

DATA: movieNights
- Fields
  - _id: 10 characters from A-Z2-9, avoiding 0/O/1/I.
  - version, host, title ≤60.
  - starts_at UTC; tz (IANA, default Africa/Tunis); ends_at.
  - place ≤80; note ≤280.
  - guests[{ref, status 'invited'|'requested'|'going'|'cant', invited_at, responded_at}] ≤20.
  - candidates ≤8, fetched server-side from keys.
  - chosen, chosen_by ('host'|'swipe'), room {code, expires_at}.
  - status 'planned'|'cancelled'.
  - reminded {day, hour}.
  - expires_at = ends_at + 14d (TTL).
- Indexes: guests.ref.profileId, host.profileId, status/starts_at, TTL.
- Limits: 10 upcoming nights per host.
- Visibility
  - The host and guests see the night.
  - Requested guests and holders of a valid token see a minimal preview: date, host first name, posters. Never guest names, place or note.
  - Everyone else gets notFound().
- Swipe link (lib/swipe.ts)
  - SwipeRoom gains night.
  - createRoom takes seed cards (candidates, then their recommendations, kid-safe when needed, up to 40).
  - In vote(), run the hook only when updateOne({_id, match:null}, {$set:{match}}) returns modifiedCount===1.
  - setChosenFromRoom sets the film only when chosen is null, or chosen_by is 'swipe' with the same room code.
  - Notify key `night:${id}:chosen:${cardKey}`.
  - A new deck never overwrites a film the host chose.

UX
1. /movie-night
- PageHeader with [Plan a night].
- 'Decide now' card → /swipe.
- Upcoming nights, then Past (14 days).
- Guest: SignInInvite (Popcorn).
2. /movie-night/new
- ?title=movie:550 prefills a candidate.
- When
  - Chips: Tonight (before 20:30), Tomorrow, next Fri, next Sat.
  - Native date and time inputs, 16px.
  - Default 21:00, or 22:00 during Ramadan.
  - At least 30 minutes ahead and at most 60 days out.
- Name, place and note are collapsed by default. Hint: 'Only the people invited see this.'
- Candidates: TitlePicker (Dialog on desktop, Drawer on phones; cmdk with Trending / My list / search 220ms).
- Invite with FriendPicker (≤20).
- Live NightCard preview and a red [Create the night], then /movie-night/{id}?created=1.
3. /movie-night/[id]
- Header: DateTile lg, title, time with 'your time', place and note (dir=auto).
- Guests: AvatarStack and a list. The host also sees invited and requested guests, with Approve / Decline on requests.
- RSVP: segmented Going / Can't.
- HostMenu: Edit, Invite, Remove guest, Turn off link (revokeInvites('night', id)), Cancel night. Shows the link use count.
- Film
  - Chosen: backdrop, 'We're watching {title}', and [Watch now] from T−30min to T+4h, otherwise Add to calendar.
  - Not chosen: a candidates grid, [Pick together] (POST {action:'room'}, then /swipe/{code}; prefill the swipe name) and the host's 'Choose this'.
- Invite: openShare({kind:'invite', target:'night', url, title, text, sendTo:{endpoint:'/api/movie-night/'+id, body:{action:'invite'}}}).
- ?invite=: InviteBanner '{host} invited you to a movie night' (ar noun form). Accept {action:'join'}.
  - When place or note is set, the consent line reads 'The host will approve your request.'
  - Kids: KidsBlocked next.
- CalendarActions: Google, Outlook, .ics.
- Poll ?v= every 15s while visible (60s after the start).
- Cancelled state.
- OG: renderNightCard. Never guest names or place.
4. Swipe edits
- Lobby: link 'Plan it for later'.
- Room: shows the night's name and a back link.
- MatchMoment: 'Back to the movie night'.
5. Stubs
- NightTile: GET /api/movie-night?next=1. Shows a mini DateTile, or 'Plan a night'. Null for Kids.
- PlanNightRow: ShareActionRow Popcorn 'Plan a movie night' → /movie-night/new?title=type:id. Null for guests and Kids.
- UpcomingNightCard: grown-up with a night within 7 days. withTimeout 4000. Compact framed card.
- DateTile: calendar leaf.

APIs (JSON, no-store; requireSocial write where noted)
- POST /api/movie-night (write)
  - Body {title?, starts_at, tz, place?, note?, candidates?: keys, invite?: handles}.
  - Invites friends only, checking blocks: night_invite with action {type:'night_invite', id}, push 'nights'.
  - 201 {id}. Rate limit 10/h.
- GET /api/movie-night (?next=1).
- GET /api/movie-night/[id]?v=
- POST /api/movie-night/[id], one action per request:
  - rsvp {going}: settles the action and notifies the host.
  - invite {handles}: host only, friends only.
  - join {token} (write)
    - consumeInvite('night'); invites have maxUses 20.
    - isBlockedEitherWay against the host and every guest.
    - With place or note set → status 'requested', and the host gets night_update with action {type:'night_join', id:`${id}:${profileId}`} (push nights).
    - Otherwise → status 'going', and the host is notified 'joined'.
  - approve {profileId, approve}: host only. Settles the action and notifies the guest.
  - addCandidate, removeCandidate, choose, room, edit (moved → notify), cancel, leave.
  - Rate limit 120/h.
- GET /api/movie-night/[id]/ics: requireSocial plus host or going guest; no-store; otherwise 404. UID night-{id}@tunisiaflicks, SEQUENCE=version, VALARM −1h.
- GET /api/cron/nights (runCron 'nights')
  - Reminders at T−24h (only if created more than 24h before) and T−1h, to the host and going guests.
  - Idempotent through the reminded flags. Respects the deadline. Returns {reminded, more}.
- Lifecycle helpers
  - onAccountDeleted(userId): cancel nights the user hosts (notify guests 'cancelled'), pull them from guest lists.
  - forgetProfileInNights(userId, profileId).
  - exportUserNights: names only.
- nightsDigestProvider. Pure rules in movie-night-rules.ts.

SHARED-FILE REQUESTS
- nav: Movie night with kidsAlt Swipe.
- Footer.
- cron.yml job 'nights' `5 */3 * * *`.
- account.ts and profiles/[id].
- Digest providers.
- legal; README.

ACCEPTANCE
1. Unit tests: zonedToUtc across DST, quickDays after 20:30, ICS CRLF/folding/escaping/SEQUENCE/VALARM, reminderDue.
2. Smoke
   - Guest /movie-night → 200.
   - Unknown id → 404.
   - POST {} → 401 or 400.
   - Unknown ics → 404; the ics of another user's night → 404.
   - Cron without auth → 401.
3. Manual
   - Create a night from the ShareSheet.
   - The inbox Going button works.
   - A link join with place set waits for approval; place stays hidden until approved.
   - Turn off link works.
   - Pick together → match → film chosen once, one notification each.
   - The calendar file imports; reminders fire once.
4. Kids: blocked; NightTile and PlanNightRow are null.
5. OG has no guest names.

## OWNER OVERRIDES (the product owner's explicit requirements; they take precedence over anything above)

Restore VOTING. The owner asked for: "propose three picks, friends vote, the winner gets a calendar invite".
- Candidates: the host proposes up to 3 picks (keep the ≤8 limit only if guests may suggest; simplest: host proposes 1–3, guests may suggest 1 each until voting opens, total ≤ 6).
- Voting: every member who is 'going' or 'invited' (and the host) casts ONE vote for one candidate, changeable until the vote closes. Store votes as `votes: { [profileKey]: candidateKey }` with atomic `$set` on `votes.<profileKey>`; show live counts and voter avatars per candidate (AvatarStack), poll like the rest of the page.
- Closing: at `vote_closes_at` (default 2 hours before `starts_at`, host-editable, never after starts_at) or when the host taps 'Close the vote'. Resolve lazily on read (GET) and in the 'nights' cron, idempotently with a `{_id, chosen: null}` guarded update (modifiedCount===1 runs the notify hook once). `chosen_by: 'vote'`.
- Tie-break: most votes; ties go to the candidate that reached its count first (earliest last-vote timestamp), then the host's own vote, then candidate order. State the rule in the UI ('Ties go to the first to get there').
- Reveal: when the result is known, the page shows a reveal moment (the three posters fanned, the winner lifts forward with spring.pop, the others dim), once per viewer (localStorage flag), reduced-motion fallback = static winner.
- Calendar: the .ics SUMMARY becomes 'Movie night: {title}' once chosen; SEQUENCE increments (version bump) so calendars update; everyone going gets a notification 'We're watching {title}' with Add to calendar.
- Keep 'Pick together' (linked Swipe room) as an alternative way to choose; a vote in progress and a swipe can't both choose: the first guarded write wins.
- Accountless guests stay cut (security review). Tests: unit tests for the tie-break and lazy close; smoke: vote endpoint auth.
