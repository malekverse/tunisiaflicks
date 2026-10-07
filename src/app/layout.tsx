import type { Metadata } from "next";
import { Cairo, Inter } from 'next/font/google';
import "./globals.css";
import { Providers } from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import Navbar from "@/src/components/Navbar";
import Sidebar from "@/src/components/Sidebar";
import Footer from "@/src/components/Footer";
import VerifyEmailBanner from "@/src/components/VerifyEmailBanner";
import { SessionProvider } from "@/src/components/SessionProvider";
import { Toaster } from "@/src/components/ui/toaster";
import ServiceWorkerRegister from "@/src/components/ServiceWorkerRegister";
import DailyPushTrigger from "@/src/components/DailyPushTrigger";
import ErrorReporter from "@/src/components/ErrorReporter";
import { I18nProvider } from "@/src/components/I18nProvider";
import { dirOf, htmlLang, isArabicScript } from "@/src/lib/i18n";
import { getLocale } from "@/src/lib/i18n/server";

import type { Viewport } from 'next'

const inter = Inter({ subsets: ["latin"] });
// Arabic UI font (Inter has no Arabic glyphs). Not preloaded: only fetched when the Arabic UI is on.
const cairo = Cairo({ subsets: ["arabic", "latin"], preload: false });

export const metadata: Metadata = {
  title: 'TunisiaFlicks',
  description: 'Stream the latest movies and TV shows for free with no ads, powered by cutting-edge technology for the best viewing experience.',
  keywords: ['Free Movies', 'Free Streaming', 'No Ads', 'Latest Movies', 'TV Shows', 'Streaming Service', 'TunisiaFlicks'],
  authors: [{ name: 'TunisiaFlicks Team' }],
  creator: 'TunisiaFlicks Team',
  publisher: 'TunisiaFlicks',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://tunisiaflicks.vercel.app'),
  // No site-wide canonical / og:url: inherited by every route, they told Google and Facebook that
  // each movie/show page was a duplicate of the homepage. Pages now default to their own URL.
  openGraph: {
    title: 'TunisiaFlicks - Free Movies and TV Shows',
    description: 'Stream the latest movies and TV shows for free, without ads, on TunisiaFlicks. High-quality entertainment at your fingertips.',
    siteName: 'TunisiaFlicks',
    images: [
      {
        url: 'https://tunisiaflicks.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TunisiaFlicks - Free Streaming Service',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TunisiaFlicks',
    description: 'Watch the latest movies and TV shows for free with no ads on TunisiaFlicks.',
    creator: '@TunisiaFlicks',
    images: ['https://tunisiaflicks.vercel.app/og-image.png'],
  },
  // viewport property moved to separate viewport export
  verification: {
    google: 'aXq6rN-W2lrmjvTfoy1CJUXSmrurfBgJ0wMOR_fQUOU',
    other: {
      me: ['malek.magraoui3@gmail.com', 'https://malek-maghraoui.netlify.app'],
    },
  },
  category: 'Entertainment',
  // Installable app (see app/manifest.ts): iOS home-screen icon and standalone mode.
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'TunisiaFlicks',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The UI language comes from a cookie (see LanguageToggle), so the very first HTML is already
  // in the right language and direction.
  const locale = getLocale();
  return (
    <html lang={htmlLang(locale)} dir={dirOf(locale)} suppressHydrationWarning>
      <head>
        {/* Almost every picture comes from TMDB: open that connection while the HTML is parsed. */}
        <link rel="preconnect" href="https://image.tmdb.org" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body className={`${isArabicScript(locale) ? cairo.className : inter.className} transition-colors duration-300`}>
        <I18nProvider locale={locale}>
          <SessionProvider>
            <Providers>
              <Navbar />
              {/* Navbar is fixed; the sidebar and <main> share one flex row below it. */}
              <div className="bg-white text-black flex min-h-screen pt-14 sm:pt-16 dark:bg-[#0d0c0f] dark:text-white">
                <Sidebar />
                {/* Content column: the page, then the footer (both beside the sidebar). */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <VerifyEmailBanner />
                  <main role="main" className="flex-1 min-w-0 flex justify-center pt-4 pb-4">
                    {children}
                  </main>
                  <Footer />
                </div>
              </div>
            </Providers>
          </SessionProvider>
          <Toaster />
        </I18nProvider>
        <SpeedInsights />
        <Analytics />
        <ServiceWorkerRegister />
        <DailyPushTrigger />
        <ErrorReporter />
      </body>
    </html>
  );
}
