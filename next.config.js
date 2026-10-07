/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip type checking during builds for better performance
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during builds for better performance
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // srcset widths. TMDB pictures go through a custom loader (src/components/TmdbImage.tsx) that
    // maps each width to a TMDB size, so these mirror TMDB's sizes: the browser never downloads a
    // bigger file than the slot needs.
    imageSizes: [45, 92, 154, 185, 300, 342, 500],
    deviceSizes: [640, 780, 1080, 1280, 1920],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'flagsapi.com',
        pathname: '**',
      },
    ],
    // domains: ['image.tmdb.org', 'flagsapi.com'],
  },
  experimental: {
    // Next 14: enables src/instrumentation.ts (server-side error monitoring setup).
    instrumentationHook: true,
  },
}

// Error monitoring (Sentry, free plan) is opt-in: without NEXT_PUBLIC_SENTRY_DSN the build is
// exactly as before. With it: server errors via src/instrumentation.ts, browser errors via
// src/lib/report-error.ts (the browser SDK is only downloaded when an error happens, so pages don't
// get heavier). Source maps are uploaded only when SENTRY_AUTH_TOKEN (+ SENTRY_ORG /
// SENTRY_PROJECT) are set too.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = require('@sentry/nextjs/config')
  module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    // Sent through our own domain so ad blockers don't drop error reports.
    tunnelRoute: '/monitoring',
    sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    disableLogger: true,
  })
} else {
  module.exports = nextConfig
}