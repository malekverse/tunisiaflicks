TRACK badges · WAVE 2 · effort L
A small, private shelf of badges computed from what a profile already watches, plus a weekly streak and a Supporter badge granted through a free Ko-fi webhook.
- No /badges page. The shelf lives on /me#badges and /u.
- Four muted metal tiers. The badge_earned inbox item is the only announcement.
- Nothing on home, nothing in e-mails about streaks, never nag.

COMMON RULES
- Worktree and git
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared with other agents.
  - Edit only your own files.
  - The git index is shared: stage only your paths and commit with `git commit -m 'msg' -- <paths>`. Never a bare commit, add -A, stash or reset. On an index.lock error, retry after 2–10s.
- Design: follow docs/DESIGN.md. Text white/50 or brighter.
- Strings: features/badges.ts (en+ar, tn, fr).
  - Arabic: never a number directly before a counted noun ('{value} من {target}'); no verb right after {name}.
- Kids: discovery badges only, and no money talk.
- Tooling
  - `npx tsc --noEmit --incremental false`. Don't touch the :3300 server.
  - Mongo 5.9: findOneAndUpdate returns {value}.
  - Tests: tests/badges.test.mjs (BASE_URL) and tests/badges.unit.test.mjs.
- Free tiers only.

USE: notify (kidsVisible), canSee (with shareKey), runCron, ProfileRef.
Stubs from foundations (keep their signatures):
- ProfileBadges
- BadgesSetting (mounted by social-pages in #privacy)
- SupporterSettings (mounted in Settings)
The user-content route already validates input (foundations); you add hooks only.

FILES: see ownership 'badges'.

CATALOGUE
Thresholds are bronze/silver/gold/platinum. Kids column: which badges Kids can earn.

| id | measures | thresholds | Kids | public |
|---|---|---|---|---|
| openingNight | first play | single, gold | yes | yes |
| marathon | best single day: distinct episodes of one show, or distinct films | 3/5/8/12 | no | yes |
| nightOwl | days with a play 00:00–04:59 | 3/10/25/50 | no | never |
| earlyBird | days with a play 05:00–08:59 | 3/10/25/50 | no | never |
| ramadan | best number of days within one Ramadan | 7/15/22/29 | no | never |
| tunisian | TN titles | 1/5/15/30 | yes | yes |
| genres | canonical genres | 5/10/14/18 | yes | yes |
| world | original languages | 3/6/10/15 | yes | yes |
| decades | release decades | 3/5/7/9 | yes | yes |
| finisher | complete seasons | 1/5/15/30 | yes | yes |
| streakWeeks | consecutive ISO weeks (Tunis) | 2/4/12/26 | no | yes |
| supporter | Ko-fi | hidden until earned | no | if opted in |

Levels only go up. Copy says 'press play'. Arabic names are gender-neutral nouns.

DATA
- badges
  - Shape: {_id: profileId, userId, kids, version, computedAt, computedDay, dirtyAt?, factsIncomplete?, earned {id: {level, at, levelAt, seenLevel, announcedLevel}}, progress, streak {current, best, thisWeek}, disabled?: boolean}.
  - Levels are written with $max.
- watchActivity
  - Shape: {_id: `${profileId}:${YYYY-MM}`, userId, profileId, month, days: [{d, n?: true, e?: true, k: playKeys[]}], expireAt}.
  - expireAt is +13 months. That covers one Ramadan and a 52-week streak.
  - No hours list is stored. n and e are only set for grown-up profiles.
  - recordPlay never throws. forgetTitle.
- titleFacts: TTL 30 days.
- supporters: {_id: userId, since, lastAt, count, listed, listName ≤30}.
- supportEvents: {_id: 'kofi:<txid>', at, emailKey: HMAC(SUPPORT_HASH_SECRET, normalized email), code, userId, expireAt +400d}.
  - SUPPORT_HASH_SECRET is required; the webhook answers 404 without it. Never use NEXTAUTH_SECRET.
  - Never store an e-mail, name, amount or message.
- users.supportCode: 'TF-' plus 5 characters, sparse unique index.

COMPUTE
- getBadgesView(owner, {refresh:'auto', budgetMs}) recomputes when it is dirty, on a new day, on a new catalogue version, or after 6h.
- Facts: ≤40 TMDB fetches per run, a 3s budget, concurrency 6.
- Hooks in /api/user-content
  - POST history: `await recordPlay(ref, item, {timeZone: safeTimeZone(item.tz)})` in try/catch. Skipped when badges.disabled is set.
  - DELETE history: forgetTitle.
- user-content.ts sends tz. It is used only to compute the day and is never stored.
- Cron /api/cron/badges (runCron)
  - Profiles dirty in the last 2 days, at most 50 per run, within the deadline.
  - For each new level: `notify({to, kind:'badge_earned', key:`${id}:${level}`, href:'/me#badges', text:{key:'badges.inbox.earned', vars:{badge}}, image:`/badges/art/${id}-${level}.svg`, kidsVisible: KIDS_BADGES.has(id), push:false})`. notify scopes event_key per profile. Then set announcedLevel.
- Kids: only kid-safe badges. Grown-up badges on a profile that becomes Kids are hidden, not deleted.

UI
1. BadgeArt (44/64/160)
- Medallion disc #0B0B0D with a metal rim gradient: bronze 176 128 84, silver 190 196 204, gold 214 178 96, platinum 216 226 236.
- Lucide glyph per badge. Locked: outline in white/15 plus a progress arc.
- No emoji, no raster, no red.
- Route /badges/art/[file].svg: image/svg+xml, immutable.
2. ProfileBadges (replaces the stub)
- owner view, section id='badges':
  - Title plus StreakChip ('{n} weeks in a row' / 'Best: {n}'; never 0, never 'lost').
  - BadgeShelf: earned tiles (64px, unseen red dot).
  - 'Up next' rows with progress bars (dir=ltr numbers).
  - BadgeDialog: 160px; spring.pop with a rim glow on first view (opacity only under reduced motion); 'Earned on {date}'. Opening POSTs /api/badges/seen.
  - Empty state: 'Your first badge is one film away'.
- public view: earned public badges only. Never nightOwl, earlyBird or ramadan. Supporter only when opted in. Streak number shown; no progress, no dates.
- Kids: discovery badges only.
3. BadgesSetting (replaces the stub)
- A SwitchRow 'Badges and streak' with hint 'Keeps a private daily log of which days you pressed play, for 13 months.'
- Turning it off calls PATCH /api/badges/settings {enabled:false}: sets disabled, deletes watchActivity, hides the shelf. Turning it on starts fresh.
- Grown-up only.
4. /support (indexable)
- Panels:
  - why it's free
  - what it costs (no invented numbers)
  - 'Buy us a coffee': SiKofi linking to NEXT_PUBLIC_SUPPORT_URL (https, _blank, noopener)
  - 'Already supporting?' with SupportCode and Copy
  - an opt-in supporters credits list (<bdi>, no amounts)
- Without the URL: EmptyState. Kids: KidsBlocked.
- Export supportUrl() from support-url.ts.
5. SupporterSettings (replaces the stub)
- `<SettingsSection id='supporter' title='Supporter' description='For your account.'>`.
- Status line, plus switches 'Show my supporter badge on my page' and 'Thank me by name' (≤30 characters, saved on blur).
6. Ko-fi webhook
- Accepts form data with a `data` field. 404 without the token. 400 when the body is bad or over 64KB. 401 on a token mismatch (length check, then timingSafeEqual).
- Idempotent. A TF code wins; otherwise a verified e-mail match.
- Always answers 200 once the token is valid. 120/min per IP. Never log the e-mail.
- GET /api/supporters/me claims lazily, at most every 12h.
7. badgesDigestProvider: 'New badges this week', never streaks.

SHARED-FILE REQUESTS
- Footer 'Support us' (gated on supportUrl).
- account.ts and profiles/[id] deleteBadgeData.
- cron.yml badges `10 2 * * *`.
- Digest providers.
- legal (13-month day flags and off switch; Ko-fi hash only).
- README (KOFI_VERIFICATION_TOKEN, NEXT_PUBLIC_SUPPORT_URL, SUPPORT_HASH_SECRET).
- sitemap /support.

ACCEPTANCE
1. Unit tests: streak gaps, levelFor, marathon dedupe, hours 4 vs 5 resolving to the n/e flags, the Ramadan window, canonicalGenres, decades, finisher, localDay across time zones, catalogue sanity.
2. Smoke: /support 200; the art route returns svg; the webhook returns 404 without the token; the cron returns 401.
3. Manual
- After watching, the cron produces badge_earned.
- A Kids profile sees its kid-safe badge in the bell.
- Two profiles on one account each get their own badge_earned for the same level.
- Public /u never shows the time badges.
- Turning badges off deletes watchActivity.
4. Ko-fi test: a supporters document is created and no plaintext e-mail is stored.