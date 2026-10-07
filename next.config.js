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
}

module.exports = nextConfig