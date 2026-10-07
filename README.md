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
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `FROM_EMAIL` | Password-reset e-mails. |

## Project layout

- `src/app` – routes. Home, TV, Discover, Top Rated, Upcoming, genres and the movie / TV detail pages are server components that fetch from TMDB through `src/lib/tmdb.ts`.
- `src/components` – shared UI. `Sidebar` + `Navbar` + `layout.tsx` form the page shell (the sidebar is part of the flex layout, so the content resizes with it). `PosterCard`, `MovieBackdropCard`, `Sliders` and `MediaGrid` render titles; `detail/` holds the movie / TV detail building blocks.
- `src/lib` – TMDB helper, list helpers, auth, Mongo and user-content client helpers.

## Scripts

- `npm run dev` – development server
- `npm run build` / `npm start` – production build and server
- `npm run lint` – ESLint
