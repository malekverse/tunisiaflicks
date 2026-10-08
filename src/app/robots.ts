import type { MetadataRoute } from 'next'
import { SITE_HOST } from '@/src/lib/seo'

// /robots.txt: crawl the catalogue, skip private, endless or redirect-only pages. Public share
// pages (/lists/:id, /wrapped/s/:token) stay crawlable so link previews always work.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/login',
          '/signup',
          '/dashboard',
          '/profile',
          '/favorites',
          '/saved',
          '/history',
          '/search',
          '/surprise',
          // Personal dashboards (exact path only; the public share pages below them stay crawlable).
          '/lists$',
          '/wrapped$',
        ],
      },
    ],
    sitemap: `https://${SITE_HOST}/sitemap.xml`,
    host: `https://${SITE_HOST}`,
  }
}
