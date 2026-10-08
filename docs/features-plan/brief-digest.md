TRACK digest · WAVE 1 · effort XL
(1) Free, secured scheduling shared by every track: src/lib/cron.ts, .github/workflows/cron.yml and docs/SCHEDULER.md.
(2) An opt-in weekly digest e-mail per profile.
(3) An account-level switch for release-alert e-mails, a shared daily mail budget, and Kids safety for release items.

COMMON RULES
- Worktree and git
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared with other agents. Edit only your files.
  - The git index is shared: stage only your paths and commit with `git commit -m 'msg' -- <paths>`. Never a bare commit, add -A, stash or reset.
  - On an index.lock error, retry after 2–10s. Never delete the lock.
- Design: follow docs/DESIGN.md. Text no fainter than white/50.
- Strings: features/digest.ts (en and ar complete, tn, fr). No verb directly after {name} in Arabic.
- Client imports come from i18n/locales.
- Code checks
  - Run `npx tsc --noEmit --incremental false`.
  - Don't start or restart the :3300 server.
  - Mongo 5.9: findOneAndUpdate returns {value}; claims check modifiedCount.
- Tests: tests/digest.test.mjs (BASE_URL) and tests/digest.unit.test.mjs.
- Free tiers only.

FILES: see ownership 'digest'. Foundations created DigestSettings and ReleaseEmailSwitch as stubs and mounted them: the digest as a group inside #notifications, the switch inside #following.

A. SCHEDULING (commit this first)
1. cron.ts
- isCronAuthorized
  - Accepts a Bearer token equal to CRON_SECRET or to any comma-separated CRON_SECRETS_EXTRA entry of at least 32 chars.
  - Compares sha256 digests with timingSafeEqual.
  - With no secret configured, it never authorizes.
- cronDeadline(source)
  - 'github', or the Vercel cron user-agent (vercel-cron): now + 45s.
  - Anything else, including 'cron-job': now + 22s, because cron-job.org aborts at 30s.
- withLease(key, ms, fn)
  - Lease document in `jobs` with _id 'cron:<key>'.
  - Claim with an upsert on lease_until < now; a duplicate-key 11000 error means busy.
  - Release only when the owner matches.
- runCron(request, name, fn)
  - Flow: auth → lease (70s) → fn({deadline: cronDeadline(source), source}), where source comes from the X-Cron-Source header.
  - Responses:
    - 401 when unauthorized
    - 200 {ok, job, status 'done'|'more'|'busy'|'idle', ms, ...stats}
    - 500 {ok:false} on error
  - Log each run to cronRuns (TTL 14 days, no PII).
  - busy and idle answer 200 on purpose.
- Route template every track copies: dynamic force-dynamic; maxDuration 60; `GET = (r) => runCron(r, '<name>', fn)`. No route hardcodes a deadline.
- /api/cron/notify: switch it to isCronAuthorized and pass its deadline to runReleaseAlerts.
2. cron.yml
- Triggers: schedule plus workflow_dispatch with input job, `type: choice`, options [digest] (integration adds the others).
- permissions: {}; concurrency; timeout-minutes 12.
- Choose step: reads github.event.schedule and the input through env vars (never `${{ }}` inside the script); a case statement maps the schedule to a job.
- Call step:
  - env: CRON_SECRET: ${{ secrets.CRON_SECRET_GH }}, SITE_URL: ${{ secrets.SITE_URL }}.
  - Loop up to 15 times: `curl -sS --fail-with-body --max-time 58 -H \"Authorization: Bearer ${CRON_SECRET}\" -H 'X-Cron-Source: github' \"${SITE_URL}/api/cron/${JOB}\"`.
  - Repeat while `jq .more` is true.
- Digest schedules: '41 16 * * 5', '41 20 * * 5', '17 8 * * 6,0'.
- Leave a commented block for nights, badges and tunisian-tv.
3. SCHEDULER.md
- cron-job.org step by step:
  - Generate a secret with `openssl rand -hex 32`.
  - Add it to CRON_SECRETS_EXTRA.
  - Send the headers Authorization and `X-Cron-Source: cron-job`.
  - Time zone Africa/Tunis, 30s timeout, failure e-mails.
- One secret per scheduler: CRON_SECRET only for Vercel cron; GitHub and cron-job.org each have their own CRON_SECRETS_EXTRA entry.
- Recommended jobs: digest every 10 min Fri–Sun; nights every 15 min; badges 03:10; tunisian-tv every 30 min.
- Rotation steps, and troubleshooting by status code.

B. MAIL BUDGET AND RELEASE ALERTS
- email.ts: reserveMail(kind)
  - Increments a rateLimit-style counter `mail:day:<UTC date>`.
  - bulk returns false once count ≥ MAIL_DAILY_LIMIT (default 450) − 70.
  - transactional always returns true but still counts.
  - Every send in email.ts calls it (auth mail counts as transactional).
- Also export: escapeHtml, emailConfigured, bulkTransport (pool, maxConnections 2, 5 per second), sendBulkMail.
- release-alerts.ts
  - Skip e-mail when users.emailPrefs.releaseAlerts === false; mark email_status 'sent', emailed_at null.
  - Before each e-mail, check reserveMail('bulk'); when it is false, stop and leave the rest for the next run.
  - At creation, stamp `kidSafe` with isKidSafe from src/lib/kids.ts.
  - Push with pushToUser(…, 'alerts', {kidSafe}), which skips Kids-profile devices for adult titles.

C. DIGEST
- Data
  - digestPrefs {_id: profileId, userId, enabled (false), locale, updated_at, unsubscribed_at?, paused_reason?, hard_bounces, last_edition}; partial index on enabled.
  - users.emailPrefs.releaseAlerts (true when missing).
  - digestEditions {_id: Friday date, opens_at, closes_at, in_ramadan, phase, enqueue_cursor, shared {[locale]}, counts}; TTL 1 year.
  - digestDeliveries {_id: '<edition>:<profileId>', status queued|building|sending|sent|skipped|failed|unknown|expired, …}; TTL 120 days.
  - At-most-once delivery:
    - a 'building' row older than 5 min goes back to queued
    - a stale 'sending' row becomes 'unknown' and is never resent
    - two hard bounces in a row set paused_reason 'bounced'
- Schedule
  - Opens Friday 17:00 Tunis time, or 21:30 during Ramadan, and stays open 3 days.
  - editionFor(now).
- Content
  - Shared snapshot per locale: new this week, new Tunisian titles, the active moment, sequel catch-ups, tonight's pick.
  - Personal sections: hero, From titles you follow, Pick up where you left off, Picks for {name} (2 seeds), moment band, providers, Still on your list.
  - Fewer than 4 tiles → skipped.
  - DIGEST_PROVIDERS: each provider gets 3s; failures are ignored; streaks are never included.
- Template
  - 600px wide, table layout, all styles inline.
  - Dark color-scheme meta, with explicit bgcolor attributes.
  - System fonts. No pixels, no redirects.
  - Wordmark PNG at 2x, made by scripts/email-assets.mjs with sharp.
  - Hero tinted with dominantColor; the CTA pill is the only red.
  - Footer: why you got this, 'This email has no tracking pixels.', settings link, unsubscribe link.
  - RTL: dir=rtl on every table, FSI/PDI isolates. Narrow no-break spaces for fr.
  - Plain-text part. Under 70KB.
  - Subject by priority (about 60 chars), plus a preheader.
- Sending
  - Headers: List-Unsubscribe, List-Unsubscribe-Post One-Click, Precedence bulk, List-Id.
  - Every send checks reserveMail('bulk') and DIGEST_DAILY_LIMIT (250).
- Token
  - Format: 'v1.' + b64url(profileId) + '.' + b64url(HMAC-SHA256(EMAIL_TOKEN_SECRET, 'unsub:v1:' + profileId)[0..16]).
  - EMAIL_TOKEN_SECRET_PREVIOUS is also accepted.
  - EMAIL_TOKEN_SECRET is required: without it, GET /api/digest returns available:false and the digest can't be turned on. Never derive the key from NEXTAUTH_SECRET.
- Run: runWeeklyDigest({deadline})
  - Phases: snapshot → enqueue (500 per page) → send.
  - 3 lanes; stop starting sends when less than 4s remain.
  - Quota reached → status 'quota'.
  - more = true while claimable deliveries remain. Outside the window → idle. Past the window → remaining deliveries expire.

D. APIs AND PAGES
- GET /api/digest: {available, locked, enabled, email, emailVerified, locale, pausedReason, releaseAlerts, next}.
- PUT /api/digest {enabled?, locale?, releaseAlerts?}
  - Grown-up only. denyLimitedSession. zod. 30 per hour.
  - Enabling needs a verified e-mail (409 otherwise). Enabling during an open window queues a delivery.
- GET /api/digest/preview: HTML with a CSP sandbox header. 12 per hour.
- POST /api/digest/test: subject prefix '[Preview] '. 2 per day.
- POST /api/unsubscribe?t=
  - Verify the HMAC first. A valid token is never rate-limited; only invalid attempts are limited (60 per hour per IP).
  - Idempotent. 400 for an invalid token.
  - GET answers a 303 to /unsubscribe?t=.
- /unsubscribe page
  - Server-rendered, noindex, works without JS (AuthShell). No-referrer header.
  - States: confirm, done (undo within 24h), already off, back on, invalid.
  - Uses form actions with a hidden token; a GET never unsubscribes. The e-mail is masked.
- DigestSettings (replace the stub)
  - Renders `<SettingsGroup id='email'>` with heading 'By email' and hint 'For this profile, sent to {email}.'
  - Contents: SwitchRow 'Weekly digest' (default off; hint 'Every Friday evening: …'); Language SegmentedRadio (layoutId pill); next-send line plus a Ramadan note; 'Preview this week' (DigestPreviewSheet: Dialog on md+, Drawer on phones, iframe sandbox='' srcDoc, phone/desktop toggle, 'Send it to me', 'Turn on').
  - Also handles these states: unverified (note + ResendVerificationButton), unavailable, paused, loading, error.
- ReleaseEmailSwitch (replace the stub): SwitchRow 'Release alerts by email', hint 'For your account.', default on, inside #following.

SHARED-FILE REQUESTS
- account.ts: exportDigestData and deleteDigestData (prefs and deliveries).
- profiles/[id] DELETE: deleteDigestPrefs (prefs and deliveries).
- legal.
- README: env vars, plus a note that rotating NEXTAUTH_SECRET doesn't affect e-mail tokens.
- ci.yml already has the test secrets.

ACCEPTANCE
1. cron.ts unit tests:
   - missing, wrong or short secret → 401
   - an extra secret is accepted
   - busy → 200
   - a cron-job source gets a 22s deadline
2. /api/cron/digest: 401 without auth; idle outside the window; done or more inside it.
3. No double sends under concurrency; a killed run never resends.
4. E-mail QA: Gmail and Apple light and dark, Outlook, Arabic RTL, under 70KB, one-click unsubscribe works.
5. /unsubscribe works without JS. A GET never unsubscribes. 100 valid one-click POSTs from one IP all succeed.
6. With the switch off, the next notify run sends no e-mail to that user and the bell still fills. A Kids-profile device gets no push for an adult title.
7. Once the bulk budget is used up, release alerts defer to the next run and a password reset still sends.
8. cron.yml uses the double-quoted header and a choice input.