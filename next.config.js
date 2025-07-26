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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Large-Allocation',
            value: 'true',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig