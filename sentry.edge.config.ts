// Sentry in the Edge runtime (middleware). Loaded from src/instrumentation.ts when a DSN is set.
import * as Sentry from '@sentry/nextjs'
import { scrubBreadcrumb, scrubEvent } from './src/lib/scrub-url'

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
  // Invite tokens, signed links and pairing codes ride in URLs: they never reach the reports.
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
})
