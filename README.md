# TunisiaFlicks

Movies and TV shows browser built with [Next.js](https://nextjs.org/) (App Router), Tailwind CSS and TMDB data.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env.local` (never commit it):

| Variable | Used for |
| --- | --- |
| `TMDB_API_KEY` | TMDB data. Server-side only; it is never sent to the browser. |
| `MONGODB_URI` | Users and their favorites / bookmarks / history. |
| `NEXTAUTH_SECRET` | Signs the session cookie. |
| `NEXTAUTH_URL` | Public URL of the site (e.g. `http://localhost:3000`). |
| `NEXT_PUBLIC_APP_URL` | Base URL used in e-mail links. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `FROM_EMAIL` | Password-reset and release-alert e-mails. |
| `CRON_SECRET` | Protects `/api/cron/notify`. Vercel Cron sends it as `Authorization: Bearer <secret>`; without it the route refuses every request. |
| `STREAM_PROVIDERS` | Optional. Replaces the player's sources without a code change: a JSON list, best first, of `{"name", "movie", "tv"}` URL templates using `{id}`, `{season}` and `{episode}` (see `src/lib/stream-providers.ts`). |
| `STREAM_PROVIDERS_OFF` | Optional. Source names to switch off, comma-separated. |
| `CRON_SECRETS_EXTRA` | Optional. Secrets for the free external schedulers (cron-job.org, GitHub Actions), comma-separated, at least 32 characters each, one per scheduler. See `docs/SCHEDULER.md`. |
| `EMAIL_TOKEN_SECRET` | Signs the weekly digest's one-click unsubscribe links (at least 32 characters, independent of `NEXTAUTH_SECRET`). Without it the digest is unavailable. `EMAIL_TOKEN_SECRET_PREVIOUS` keeps old links working during a rotation. |
| `DIGEST_ENABLED` | Optional. `false` turns the weekly digest off. |
| `MAIL_DAILY_LIMIT` | Optional. E-mails sent per day across the site (default 450, of which 70 are kept for account mail such as password resets). `DIGEST_DAILY_LIMIT` (default 250) caps the digest's share. |
| `SOCIAL_ACTIVITY_DELAY_MINUTES` | Optional. How long before a friend's watch appears in the friends feed (default 120; 0 in development). |
| `SEASONS_TODAY` | Development only (ignored in production): a `YYYY-MM-DD` day whose season the app shows (nav slot, home banner, moment pages, room light), e.g. `2027-02-20` for day 13 of Ramadan. In a browser the `tf-seasons-today` cookie does the same. |
| `GROQ_API_KEY` | Turns Ask (AI search) on. Use a free Groq key from an organization with no payment method, so nothing can ever be billed. Without it Ask disappears completely: no home chip, no palette item, no switch, and `/api/ai/search` answers 404. |
| `AI_SEARCH_OFF` | Optional. `1` turns Ask off while keeping the key. |
| `AI_SEARCH_MODELS` | Optional. Comma-separated Groq model ids, tried in this order (default: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, then whatever else Groq lists). |
| `AI_DAILY_CALLS` | Optional. Model calls per day for the whole site (default 300; guests may use 40%). Once spent, Ask answers with simple matching and says so. One call is about 1.7k tokens. |
| `YOUTUBE_API_KEY` | Optional, recommended. Lets Tunisian TV read the channels' playlists (complete series) through the YouTube Data API, capped at 3,000 units a day. Without it, Tunisian TV uses the free channel feeds only. |
| `TUNISIAN_TV_CHANNELS`, `TUNISIAN_TV_CHANNELS_OFF` | Optional. Comma-separated channel slugs: only these / never these. `TUNISIAN_TV_CHANNELS_OFF=*` turns Tunisian TV off entirely (the job stops, the hub says it is warming up, channel pages are 404s). |
| `NEXT_PUBLIC_SUPPORT_URL` | Optional. The https Ko-fi page. Without it, `/support` says support isn't open yet and is noindex, and the footer and sitemap leave it out. |
| `KOFI_VERIFICATION_TOKEN` | Optional. From Ko-fi > Settings > API > Webhooks; the webhook URL is `https://<site>/api/supporters/webhook`. |
| `SUPPORT_HASH_SECRET` | Optional. At least 32 random characters, independent of `NEXTAUTH_SECRET`; hashes payers' e-mail addresses. The webhook answers 404 until both Ko-fi variables are set. |

### Release alerts

Signed-in users can tap **Notify me** on an upcoming movie (detail page or `/upcoming` cards) or **Follow** on a running TV show. Follows live in the `follows` collection, one document per user and title.

`vercel.json` schedules `/api/cron/notify` once a day (08:00 UTC; the Hobby plan allows one run a day and may fire it any time within that hour). The job asks TMDB about every followed title once, records a notification per follower when a movie's release date is reached or a show's latest aired episode is newer than the one the follower already knows, then sends each user a single e-mail with everything new. Notifications also feed the bell in the navbar. Unique keys and claim markers make it safe to run twice: nobody gets the same alert twice, and failed e-mails are retried on the next run (up to 3 times). To trigger it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/notify
```

### Languages

English, French, Arabic (MSA) and Tunisian Derja. The interface language lives in the `tf-locale`
cookie (and in the account when signed in); a first visit negotiates from `Accept-Language` (en, fr or
ar; Derja is only ever chosen). Core strings are in `src/lib/i18n/{en,fr,ar,tn}.ts`; each feature
keeps its own in `src/lib/i18n/features/<feature>.ts`. `npm run check:i18n` checks that every key is
translated (and French typography), and that no client file bundles the dictionaries.

### Friends

Each grown-up profile can create a page with a handle (`/u/<handle>`). Friends are mutual and found by
exact handle or invite link (no directory). Activity and ratings are private until the person shares
them; friends see watches with a delay, and only from when sharing was turned on. A block covers the
whole account. Recommendations ("send to a friend") and invitations land in the notification bell.
Kids profiles have no social features.

### Turkish and Korean dramas

`/dramas`, `/dramas/turkish` and `/dramas/korean` (with `?shelf=romance|historical|thrillers|short|films`),
from TMDB discover and trending, rotated daily (Tunis time). The featured series is remembered per day in
`dramaPicks` (30-day expiry) so it never repeats; YouTube thumbnails go through `/api/yt-thumb/...` so
visitors only reach Google when they press play.

### Weekly digest and scheduled jobs

An opt-in weekly e-mail per profile ("what's new this week + picks for you"), with one-click unsubscribe
and no tracking. Scheduled jobs run through secured `/api/cron/*` routes: Vercel's daily cron for release
alerts, and a free external scheduler for the rest (cron-job.org first, GitHub Actions as fallback).
Setup: `docs/SCHEDULER.md`.

### Ask (AI search)

In `/search`, the search palette and the home chips, a question in plain words ("funny korean films from
the 90s", in any of the four languages) becomes TMDB filters through Groq's free tier (`src/lib/ai-search`,
`POST /api/ai/search`, streamed as NDJSON). A shared `?p=` link replays the plan without calling the model.
Requests are rate-limited and the day's budget fails closed to a simple parser. Not offered on Kids profiles
or in TV mode. Eval: `node --env-file=.env.local --import ./tests/register.mjs scripts/ai-search-eval.mjs`
runs 40 requests and 10 prompt injections (about 90k tokens); `--parser` runs it offline, and `--match`,
`--only` and `--limit` narrow it.

### Friends and your page

`/friends` (the feed, by day) and `/friends/list` (requests, friends, add by exact handle, invite link);
`/u/<handle>` (`?k=` opens what is set to "Anyone with the link", `?invite=` opens a friend invitation); `/me`
(goes to your page, or shows badges, Your year, lists and the page setup); `/notifications`; Settings
`#privacy`. The real 404, 308 and 302 of `/u` and `/me` come from the middleware, through
`src/app/u/_lib/gate.ts` and the internal `/u/[handle]/gate` and `/me/gate` routes (signed with a token derived
from `NEXTAUTH_SECRET`). Seeded smoke tests: `SOCIAL_PAGES_SEED=<json> BASE_URL=... node --import
./tests/register.mjs --test tests/social-pages.test.mjs`.

### Shared lists and movie nights

Lists several people build together: an owner and editors, invitation links, per-list visibility (only the
people in it, friends, or anyone with the link) and live updates by polling. Movie nights (`/movie-night`):
a date, up to six films, invited friends vote, the winner is revealed, and everyone going gets a calendar
file; reminders a day and an hour before come from the `nights` job. Kids get Swipe instead. Concurrency
check (local database only): `node --env-file=.env.local scripts/shared-lists-concurrency.mjs --uri
mongodb://127.0.0.1:27017/<test db> --base http://localhost:3000`.

### Badges, streaks and support

Badges are computed nightly (the `badges` job) from a private per-profile log of the days you pressed play;
the weekly streak never shows 0 or "lost". `/support` links to Ko-fi; a coffee is matched to an account by a
keyed hash of the payer's e-mail (or a `TF-` code in the message) and earns the Supporter badge.

### Arab cinema map

`/arab-cinema` is a tile map of the 22 Arab League members, each lit by its film of the day.
`/arab-cinema/[cc]` (lowercase ISO codes; uppercase redirects, `tn` goes to `/tunisian/cinema`, anything else
is a 404) gives each country its stats, today's pick, rows and the people born there, all from TMDB by country
of origin. The index is cached for the day (per TMDB language, Kids separately and filtered before caching),
about 66 TMDB calls per language and profile kind. A country page costs about 14 calls, plus about 50 for its
people (cached 7 days).

### Tunisian TV

`/tunisian/tv` and `/tunisian/tv/[channel]`: the official channels' series, shows and live streams from
YouTube, read by the `tunisian-tv` job (free channel feeds, plus playlists with `YOUTUBE_API_KEY`). Pictures go
through our server and the player loads only on Play, so visitors reach YouTube only when they watch.

### Title pages

Ratings from friends, "More like this, but…" (lighter, darker, shorter, older, newer, as a series or a film,
from the Arab world; `GET /api/more-like-this`), Extras (YouTube videos by kind), the soundtrack from Deezer
(no key; the matching album per title is cached in `soundtracks`: 60 days when found, 30 days when not, 1 hour
after an error; three reports of a wrong album block it) and "Where have I seen them?" on the cast.

### TV mode

Any TV browser: `/?tv=1` (or the offer, or the setting) switches to a remote-friendly shell with a focus engine
on the same URLs; `/?tv=0` switches back. A TV signs in by showing a code that you approve from your phone at
`/activate`; TV sessions are tied to one profile, can't change account settings, and are listed and revocable
in Settings `#security`. `/app` explains installing the site and TV mode. (The Android TV APK and the Google
Play app are parked on the `feat/android-apps` branch.)

## Project layout

- `src/app` – routes. Home, TV, Discover, Top Rated, Upcoming, genres and the movie / TV detail pages are server components that fetch from TMDB through `src/lib/tmdb.ts`.
- `src/components` – shared UI. `Sidebar` + `Navbar` + `layout.tsx` form the page shell (the sidebar is part of the flex layout, so the content resizes with it). `PosterCard`, `MovieBackdropCard`, `Sliders` and `MediaGrid` render titles; `detail/` holds the movie / TV detail building blocks.
- `src/lib` – TMDB helper, list helpers, auth, Mongo and user-content client helpers.

## Scripts

- `npm run dev` – development server
- `npm run build` / `npm start` – production build and server
- `npm run lint` – ESLint
- `npm run check:i18n` – translations complete, French typography, no dictionaries in the browser bundle
- `npm run test:unit` – unit tests (Node 22)
