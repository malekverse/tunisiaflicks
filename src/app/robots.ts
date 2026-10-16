import type { MetadataRoute } from 'next'
import { SITE_HOST } from '@/src/lib/seo'

// /robots.txt: crawl the catalogue, skip private, endless or redirect-only pages. Public share
// pages (/lists/:id, /wrapped/s/:token, /u/:handle, /movie-night/:id) stay crawlable so link previews always work.
//
// AI crawlers (training, AI search, data brokers) are turned away: every page here is rendered
// fresh by a server function (~0.5 MB each), and their endless walks through the catalogue
// (every title links to twenty more) are what spends the free plan's monthly transfer. Search
// engines and link previews (facebookexternalhit, WhatsApp, Twitterbot…) are not on the list.
const AI_CRAWLERS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'CCBot', 'Google-Extended', 'Applebot-Extended', 'meta-externalagent', 'meta-externalfetcher', 'FacebookBot',
  'Bytespider', 'Amazonbot', 'PerplexityBot', 'Perplexity-User', 'cohere-ai', 'cohere-training-data-crawler',
  'Diffbot', 'ImagesiftBot', 'Omgilibot', 'Omgili', 'Timpibot', 'YouBot', 'AI2Bot', 'Ai2Bot-Dolma',
  'PetalBot', 'DataForSeoBot', 'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'Scrapy',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, disallow: '/' },
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
          // Approving a TV from a phone, the friends feed and the bell: private.
          '/activate',
          '/download/',
          '/friends',
          '/notifications',
          // Personal dashboards (exact path only; the public share pages below them stay crawlable).
          '/lists$',
          '/wrapped$',
          '/me$',
          '/movie-night$',
        ],
      },
    ],
    sitemap: `https://${SITE_HOST}/sitemap.xml`,
    host: `https://${SITE_HOST}`,
  }
}
