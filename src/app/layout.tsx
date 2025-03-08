import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import { Providers } from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import Navbar from "@/src/components/Navbar";
import Sidebar from "@/src/components/Sidebar";
import { SessionProvider } from "@/src/components/SessionProvider";
import Loader from "../components/Loader";

import type { Viewport } from 'next'

const inter = Inter({ subsets: ["latin"] });

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
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
      'ar-TN': '/ar-TN',
    },
  },
  openGraph: {
    title: 'TunisiaFlicks - Free Movies and TV Shows',
    description: 'Stream the latest movies and TV shows for free, without ads, on TunisiaFlicks. High-quality entertainment at your fingertips.',
    url: 'https://tunisiaflicks.vercel.app',
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
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  verification: {
    google: 'aXq6rN-W2lrmjvTfoy1CJUXSmrurfBgJ0wMOR_fQUOU',
    yandex: 'your-yandex-verification',
    yahoo: 'your-yahoo-verification',
    other: {
      me: ['malek.magraoui3@gmail.com', 'https://malek-maghraoui.netlify.app'],
    },
  },
  category: 'Entertainment',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} transition-colors duration-300`}>
        <SessionProvider>
          <Providers>
            <Navbar />
            <div className="bg-white text-black flex min-h-screen dark:bg-[#0d0c0f] dark:text-white">
              <Sidebar />
              <main role="main" className="flex justify-center sm:pt-20 pt-14 w-full">
                <Loader/>
                {children}
              </main>
            </div>
          </Providers>
        </SessionProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}

