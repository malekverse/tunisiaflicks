import type { Metadata } from "next";
import { Alexandria, Bricolage_Grotesque, Readex_Pro } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import "./globals.css";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import Footer from "@/src/components/Footer";
import Rail from "@/src/components/shell/Rail";
import TopBar from "@/src/components/shell/TopBar";
import TabBar from "@/src/components/shell/TabBar";
import RoomLight from "@/src/components/shell/RoomLight";
import ShellEffects from "@/src/components/shell/ShellEffects";
import MotionProvider from "@/src/components/shell/MotionProvider";
import SearchPaletteHost from "@/src/components/search/SearchPaletteHost";
import PeekLayer from "@/src/components/media/PeekLayer";
import VerifyEmailBanner from "@/src/components/VerifyEmailBanner";
import { SessionProvider } from "@/src/components/SessionProvider";
import { Toaster } from "@/src/components/ui/toaster";
import ServiceWorkerRegister from "@/src/components/ServiceWorkerRegister";
import DailyPushTrigger from "@/src/components/DailyPushTrigger";
import ErrorReporter from "@/src/components/ErrorReporter";
import { I18nProvider } from "@/src/components/I18nProvider";
import ShareSheetHost from "@/src/components/share/ShareSheetHost";
import AddToListHost from "@/src/components/lists/AddToListHost";
import LanguageHint from "@/src/components/shell/LanguageHint";
import TvModeProvider from "@/src/components/tv/TvModeProvider";
import TvShell from "@/src/components/tv/TvShell";
import TvModeOffer from "@/src/components/tv/TvModeOffer";
import AppOffer from "@/src/components/apps/AppOffer";
import { getAppReleases, getDesktopRelease } from "@/src/lib/app-releases";
import { INSTALL_PROMPT_SCRIPT } from "@/src/lib/install-prompt-script";
import { LAUNCH_SCRIPT } from "@/src/lib/launch-script";
import AppLaunch from "@/src/components/brand/AppLaunch";
import { withTimeout } from "@/src/lib/with-timeout";
import { clientMessages, dirOf, htmlLang } from "@/src/lib/i18n";
import { getLocale, getT } from "@/src/lib/i18n/server";
import { getKidsMode } from "@/src/lib/profiles";
import { SEASONS_TODAY_COOKIE, getSeasonalNav, getSeasonSkin, seasonClock } from "@/src/lib/seasons";
import { isTvMode } from "@/src/lib/tv-mode";
import { aiSearchEnabled } from "@/src/lib/ai-search/config";
import { SITE_DESCRIPTION, SITE_URL, siteMetadata } from "@/src/lib/seo";
import { cookies, headers } from "next/headers";

import type { Viewport } from 'next'

// Type: Readex Pro for the interface (it covers Latin and Arabic, so every language reads alike),
// Bricolage Grotesque, condensed, for Latin titles, and Alexandria for Arabic titles. The Arabic
// files carry a unicode-range, so browsers only download them when Arabic text is on the page.
const text = Readex_Pro({ subsets: ['latin'], variable: '--font-text', display: 'swap' });
const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz', 'wdth'], variable: '--font-display', display: 'swap' });
const displayArabic = Alexandria({ subsets: ['arabic'], variable: '--font-display-ar', display: 'swap', preload: false });

const baseMetadata: Metadata = {
  title: 'TunisiaFlicks: movies, TV shows and Tunisian series',
  description: SITE_DESCRIPTION,
  keywords: ['Movies', 'TV shows', 'Tunisian series', 'Ramadan series', 'Trailers', 'Top 10', 'مسلسلات تونسية', 'مسلسلات رمضان', 'TunisiaFlicks'],
  authors: [{ name: 'TunisiaFlicks Team' }],
  creator: 'TunisiaFlicks Team',
  publisher: 'TunisiaFlicks',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  // No site-wide canonical / og:url: inherited by every route, they told Google and Facebook that
  // each movie/show page was a duplicate of the homepage. Pages set their own (see pageMetadata).
  // The defaults below are for pages that set nothing; no twitter title or description, or X
  // would show the site's on every page that only sets Open Graph ones.
  openGraph: {
    title: 'TunisiaFlicks: movies, TV shows and Tunisian series',
    description: SITE_DESCRIPTION,
    siteName: 'TunisiaFlicks',
    images: [{ url: '/og/home', width: 1200, height: 630, alt: 'TunisiaFlicks' }],
    locale: 'en_US',
    alternateLocale: ['ar_TN'],
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
    creator: '@TunisiaFlicks',
    images: ['/og/home'],
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
    // The vector "A" (app/icon.svg), sharp at every size; favicon.ico stays for older browsers.
    icon: [{ url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'TunisiaFlicks',
    statusBarStyle: 'black-translucent',
  },
};

/** The site's title, description and og:locale in the page's language (the cookie). */
export function generateMetadata(): Metadata {
  const site = siteMetadata(getLocale(), getT());
  return { ...baseMetadata, ...site, openGraph: { ...baseMetadata.openGraph, ...site.openGraph } };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Paint under the notch and home indicator; fixed bars pad themselves with env(safe-area-*).
  viewportFit: 'cover',
  // Android: the keyboard shrinks the layout, like on iOS.
  interactiveWidget: 'resizes-content',
  themeColor: '#000000',
  colorScheme: 'dark',
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The UI language comes from a cookie (see LanguageSwitch), so the very first HTML is already
  // in the right language and direction.
  const locale = getLocale();
  const t = getT();
  // Who's watching (Kids hide grown-up items from the nav without a flash), TV mode (cookie
  // tf-tv=1, see src/middleware.ts), the Android TV app (its WebView adds this token to the user
  // agent), and the season (the nav slot, and the room's default light).
  const kids = await getKidsMode().catch(() => false);
  const tv = isTvMode();
  // The search pill offers Ask (AI search) too: never for Kids or in TV mode.
  const ask = aiSearchEnabled() && !kids && !tv;
  const inApp = (headers().get('user-agent') ?? '').includes('TunisiaFlicksTV/');
  // The apps with a release (cached for 10 minutes; see src/lib/app-releases.ts), for the offer.
  const [releases, desktopRelease] = await Promise.all([
    withTimeout(getAppReleases(), 1500, null),
    withTimeout(getDesktopRelease(), 1500, null),
  ]);
  const megabytes = (bytes?: number) => (bytes ? Math.max(0.1, Math.round(bytes / 104857.6) / 10) : null);
  const offeredApps = { android: megabytes(releases?.apps.android?.size), tv: megabytes(releases?.apps.tv?.size), desktop: megabytes(desktopRelease?.file.size) };
  // In development a cookie can preview another day's season (seasonClock ignores it in production).
  const { today: seasonDay } = seasonClock(cookies().get(SEASONS_TODAY_COOKIE)?.value);
  const seasonal = getSeasonalNav(kids, seasonDay);
  const skin = getSeasonSkin(kids, seasonDay);
  const seasonStyle = skin
    ? ({ '--season-light': skin.light, ...(skin.glow ? { '--season-glow': skin.glow } : {}) } as React.CSSProperties)
    : undefined;

  // The page column. In TV mode the remote-friendly shell wraps it instead of the usual chrome.
  const page = (
    <div className="relative flex min-h-dvh flex-col">
      <VerifyEmailBanner />
      {!tv && <TvModeOffer />}
      <AppOffer apps={offeredApps} />
      <main id="main" role="main" className="flex-1 min-w-0">
        {children}
      </main>
      {!tv && <Footer kids={kids} />}
    </div>
  );

  return (
    <html
      lang={htmlLang(locale)}
      dir={dirOf(locale)}
      className={`dark ${text.variable} ${display.variable} ${displayArabic.variable}`}
      data-tv={tv ? '1' : undefined}
      data-season={skin?.id}
      style={seasonStyle}
      suppressHydrationWarning
    >
      <head>
        {/* Almost every picture comes from TMDB: open that connection while the HTML is parsed. */}
        <link rel="preconnect" href="https://image.tmdb.org" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        {/* Before the first paint: is this the start of an app? Then the launch screen shows (AppLaunch). */}
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_SCRIPT }} />
      </head>
      <body>
        {/* Before anything else: keep the browser's one-time "install this site" offer for later. */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_SCRIPT }} />
        <AppLaunch />
        <NextTopLoader color="#FF2414" height={2} showSpinner={false} shadow={false} easing="cubic-bezier(0.23, 1, 0.32, 1)" speed={260} />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black">
          {t('nav.skipToContent')}
        </a>
        <I18nProvider locale={locale} messages={clientMessages(locale)}>
          <TvModeProvider tv={tv} inApp={inApp}>
            <SessionProvider>
              <MotionProvider>
                <RoomLight />
                {tv ? (
                  <>
                    <ShellEffects />
                    <TvShell>{page}</TvShell>
                  </>
                ) : (
                  <>
                    <Rail kids={kids} seasonal={seasonal} />
                    <TopBar kids={kids} ask={ask} />
                    <ShellEffects />
                    {page}
                    <TabBar kids={kids} seasonal={seasonal} />
                    <SearchPaletteHost />
                    <PeekLayer />
                    <ShareSheetHost />
                    <AddToListHost />
                  </>
                )}
              </MotionProvider>
            </SessionProvider>
            <Toaster />
            <LanguageHint />
          </TvModeProvider>
        </I18nProvider>
        <div aria-hidden className="tf-grain" />
        <SpeedInsights />
        <Analytics />
        <ServiceWorkerRegister />
        <DailyPushTrigger />
        <ErrorReporter />
      </body>
    </html>
  );
}
