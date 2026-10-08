# Scheduled jobs

TunisiaFlicks runs its background jobs for free. Every job is a GET route under `/api/cron/<job>`
that needs a secret, does a bounded amount of work, and says whether there is more to do. Three
schedulers call those routes:

| Scheduler | What it calls | Secret | Time budget per call |
|---|---|---|---|
| **Vercel Cron** (Hobby: one cron a day) | `/api/cron/notify` (release alerts), daily 08:00 UTC, from `vercel.json` | `CRON_SECRET` | 45s |
| **cron-job.org** (primary for everything else) | `/api/cron/digest`, and after wave 2 `nights`, `badges`, `tunisian-tv` | its own entry in `CRON_SECRETS_EXTRA` | 22s (it aborts requests at 30s) |
| **GitHub Actions** (fallback), `.github/workflows/cron.yml` | the same routes a few times a week, looping while the answer says `more` | its own entry in `CRON_SECRETS_EXTRA` (`CRON_SECRET_GH` in GitHub) | 45s |

How a route behaves (`src/lib/cron.ts`):

- It needs `Authorization: Bearer <secret>`, where the secret is `CRON_SECRET` or any
  comma-separated entry of `CRON_SECRETS_EXTRA` that is at least 32 characters long. With no
  secret configured, nothing is ever allowed in.
- `X-Cron-Source: github` (or Vercel's own cron) gets 45 seconds; `X-Cron-Source: cron-job`, and
  anything else, gets 22.
- Only one run of a job at a time: a second call while one is running answers `busy`.
- The answer is JSON: `{ ok, job, status, more, ms, ...counts }`, where `status` is `done`,
  `more`, `busy`, `idle` (nothing to do right now) or `quota` (the day's e-mail budget is spent).
  `busy`, `idle` and `quota` are normal and answer **200**.
- Runs are logged in the `cronRuns` collection for 14 days (counts only, no personal data).

## One secret per scheduler

Each scheduler has its own secret, so one can be replaced without touching the others:

- `CRON_SECRET`: only Vercel Cron (Vercel sends it by itself).
- `CRON_SECRETS_EXTRA`: comma-separated, one entry for cron-job.org and one for GitHub, e.g.
  `CRON_SECRETS_EXTRA=<cron-job.org secret>,<GitHub secret>`.

Generate each one with:

```sh
openssl rand -hex 32
```

## cron-job.org, step by step

1. Generate a secret (`openssl rand -hex 32`) and add it to `CRON_SECRETS_EXTRA` in Vercel
   (Settings > Environment Variables, Production). Redeploy so the site sees it.
2. Create a free account at https://cron-job.org and verify the e-mail.
3. Settings (account): time zone **Africa/Tunis**.
4. Create a cron job for each route below:
   - URL: `https://<your site>/api/cron/digest`
   - Request method: GET.
   - Advanced > Headers:
     - `Authorization`: `Bearer <the secret>`
     - `X-Cron-Source`: `cron-job`
   - Advanced > Timeout: 30 seconds.
   - Notifications: e-mail on failure (and after it recovers).
   - Schedule: see the table below.
5. Press "Test run" once: the answer should be `200` with `"status":"idle"` (or `done`/`more`).

Recommended schedules (Africa/Tunis):

| Route | Schedule | Why |
|---|---|---|
| `/api/cron/digest` | every 10 minutes, Friday to Sunday | The weekly digest opens Friday 17:00 (21:30 during Ramadan) and stays open three days; each call sends a slice. |
| `/api/cron/nights` | every 15 minutes | Movie-night reminders and vote closing (after wave 2). |
| `/api/cron/badges` | daily at 03:10 | Badges and streaks (after wave 2). |
| `/api/cron/tunisian-tv` | every 30 minutes | Tunisian TV ingest (after wave 2). |

## GitHub Actions (fallback)

1. Generate a secret and add it to `CRON_SECRETS_EXTRA` in Vercel, next to the cron-job.org one.
2. In the GitHub repository: Settings > Secrets and variables > Actions > New repository secret:
   - `CRON_SECRET_GH`: that secret.
   - `SITE_URL`: `https://<your site>` (no trailing slash needed).
3. Actions > Cron > Run workflow lets you run a job by hand (the job list is a choice).

The workflow calls with `X-Cron-Source: github` (45s per call) and calls again while the answer
says `"more": true`, up to 15 times. Its schedules are in UTC (Tunis is UTC+1): the digest runs
Friday 16:41 and 20:41 UTC, then Saturday and Sunday 08:17 UTC.

## Rotating a secret

1. Generate a new secret.
2. Add it to `CRON_SECRETS_EXTRA` next to the old one (or, for Vercel's cron, replace
   `CRON_SECRET`) and redeploy.
3. Update the scheduler (cron-job.org header, or the `CRON_SECRET_GH` GitHub secret).
4. Check one run answers 200, then remove the old entry and redeploy.

E-mail unsubscribe links are signed with `EMAIL_TOKEN_SECRET`, not with any cron secret or
`NEXTAUTH_SECRET`; rotating those never breaks a link. To rotate `EMAIL_TOKEN_SECRET`, move the old
value to `EMAIL_TOKEN_SECRET_PREVIOUS` first so links already sent keep working.

## Troubleshooting

| Answer | Meaning | What to do |
|---|---|---|
| `401` | The secret is missing or wrong, or an extra secret is shorter than 32 characters. | Check the `Authorization: Bearer ...` header (cron-job.org: Advanced > Headers) and `CRON_SECRETS_EXTRA` in Vercel, then redeploy. |
| `200` `"status":"busy"` | Another run of the same job is still going. | Nothing; the next call continues. If it lasts more than ~2 minutes, a run was killed and its lease frees itself after 70s. |
| `200` `"status":"idle"` | Nothing to do now (e.g. the digest outside Friday 17:00 to Monday 17:00, or not configured). | Nothing. For the digest, check `EMAIL_TOKEN_SECRET` and the e-mail settings if it stays idle on a Friday evening. |
| `200` `"status":"quota"` | The day's e-mail budget (`MAIL_DAILY_LIMIT`, 70 kept for account e-mails) or `DIGEST_DAILY_LIMIT` is used up. | Nothing; the rest goes out on the next day's runs. |
| `200` `"more":true` | Time ran out with work left. | Nothing; cron-job.org calls again in 10 minutes, GitHub loops right away. |
| `500` | The job failed. | Read the function logs in Vercel (Deployments > Functions). |
| timeout | The call took longer than the scheduler waited. | cron-job.org must send `X-Cron-Source: cron-job` (22s budget); without it the route still uses 22s, so look at the logs. |

## Adding a job

1. A route at `src/app/api/cron/<name>/route.ts`:
   ```ts
   import { runCron } from '@/src/lib/cron'
   export const dynamic = 'force-dynamic'
   export const maxDuration = 60
   export const GET = (r: Request) => runCron(r, '<name>', ({ deadline }) => myJob({ deadline }))
   ```
   The job stops starting new work near `deadline` (never hardcode one) and returns its counts
   plus `more: true` when work is left.
2. A cron-job.org job (above), and in `cron.yml` a schedule, a `case` line and a job option.
