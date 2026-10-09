import type { MetadataRoute } from 'next'

// Web app manifest: makes the site installable ("Add to Home Screen") with its own icon,
// splash colours and a standalone, app-like window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable identity for the installed app (and the Google Play app built from it).
    id: '/',
    name: 'TunisiaFlicks',
    short_name: 'TunisiaFlicks',
    description: 'Movies, TV shows and Tunisian series in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['entertainment'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the app icon (Android) for quick entry points.
    shortcuts: [
      { name: 'Discover', url: '/discover', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'TV Shows', url: '/tv', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Clips', url: '/clips', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Surprise me', url: '/surprise', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
