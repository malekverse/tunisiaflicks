// Browser error reporting (Sentry, free plan), loaded lazily: the SDK (~70 kB) is only downloaded
// when an error actually happens, so normal page loads pay nothing. Off without NEXT_PUBLIC_SENTRY_DSN.
type SentryModule = typeof import('@sentry/nextjs')

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
let sentry: Promise<SentryModule> | null = null

function load() {
  return (sentry ??= import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
      // Through our own domain (next.config.js tunnelRoute) so ad blockers don't drop reports.
      tunnel: DSN && /ingest\.(us\.|de\.)?sentry\.io/.test(DSN) ? '/monitoring' : undefined,
      // Noise from browser extensions and third-party players, not from our code.
      ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', /^Script error\.?$/],
      denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
    })
    return Sentry
  }))
}

export function reportError(error: unknown) {
  if (!DSN) return
  load().then((Sentry) => Sentry.captureException(error)).catch(() => {})
}

/**
 * Reports uncaught errors and promise rejections until the SDK is loaded (it then installs its own
 * global handlers, so ours step aside). Returns a cleanup function.
 */
export function watchGlobalErrors() {
  if (!DSN) return () => {}
  const onError = (event: ErrorEvent) => handle(event.error ?? event.message)
  const onRejection = (event: PromiseRejectionEvent) => handle(event.reason)
  const stop = () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
  const handle = (error: unknown) => {
    stop()
    reportError(error)
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return stop
}
