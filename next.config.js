/** @type {import('next').NextConfig} */
const nextConfig = {
  serverOptions: {
    // Increase header size limit
    maxHeaderSize: 32768, // 32KB
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