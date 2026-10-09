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
