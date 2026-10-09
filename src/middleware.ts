import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TV_CHOSEN_COOKIE, TV_COOKIE } from '@/src/lib/tv-mode';
import { isSmartTvBrowser } from '@/src/lib/device-platform';
import { profilePageGate } from '@/src/app/u/_lib/middleware-gate';
import { isArabCountry } from '@/src/lib/arab-countries';
import { isHubId } from '@/src/lib/dramas-config';
import { channelBySlug } from '@/src/lib/tunisian-tv/channels';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Pages whose access depends on being signed in (the only ones that need the session token). */
const AUTH_PATHS = ['/dashboard', '/login', '/signup', '/profiles'];

/**
 * TV mode is a cookie, switched from the home page: /?tv=1 turns it on (the Android TV app starts
 * there), /?tv=0 turns it off. Either way the visitor lands on / with the other parameters kept.
 * A Samsung / LG TV's browser gets it on by itself, once (autoTvMode).
 * Not httpOnly: the TV settings read it to show the switch's state.
 */
function switchTvMode(req: NextRequest): NextResponse | null {
  const value = req.nextUrl.searchParams.get('tv');
  if (value !== '1' && value !== '0') return autoTvMode(req);

  const url = req.nextUrl.clone();
  url.searchParams.delete('tv');
  const response = NextResponse.redirect(url);
  if (value === '1') {
    response.cookies.set(TV_COOKIE, '1', tvCookie(req));
  } else {
    response.cookies.delete(TV_COOKIE);
    response.cookies.set(TV_CHOSEN_COOKIE, '1', tvCookie(req));
  }
  return response;
}

const tvCookie = (req: NextRequest) => ({
  path: '/',
  maxAge: ONE_YEAR,
  sameSite: 'lax' as const,
  httpOnly: false,
  secure: req.nextUrl.protocol === 'https:',
});

/**
 * A Samsung or LG TV's own browser (they can't install the Android TV app) opening the home page
 * for the first time: switch TV mode on by itself, once. If the viewer turns it off, it stays off.
 */
function autoTvMode(req: NextRequest): NextResponse | null {
  if (req.method !== 'GET' || req.cookies.has(TV_COOKIE) || req.cookies.has(TV_CHOSEN_COOKIE)) return null;
  if (!isSmartTvBrowser(req.headers.get('user-agent') ?? '')) return null;
  const response = NextResponse.redirect(req.nextUrl.clone());
  response.cookies.set(TV_COOKIE, '1', tvCookie(req));
  response.cookies.set(TV_CHOSEN_COOKIE, '1', tvCookie(req));
  return response;
}

const notFoundPage = (req: NextRequest) => NextResponse.rewrite(new URL('/404', req.nextUrl.origin));

/**
 * Pages stream from the root loading.tsx, so inside a page a redirect can only be a 200 with a meta
 * refresh, and notFound() a 200 too. The sections whose addresses are a closed set get their real
 * statuses here instead:
 * - /arab-cinema/<cc>: a lowercase ISO code of an Arab League member. /arab-cinema/EG is a 308 to
 *   /arab-cinema/eg, Tunisia's page is /tunisian/cinema, anything else is a 404.
 * - /dramas/<hub>: turkish or korean.
 * - /tunisian/tv/<channel>: an enabled channel.
 * Deeper paths (share cards, a channel's avatar) are left to their own routes.
 */
function closedSetStatus(req: NextRequest): NextResponse | null {
  const match = /^\/(arab-cinema|dramas|tunisian\/tv)\/([^/]+)\/?$/.exec(req.nextUrl.pathname);
  if (!match) return null;
  const [, section, segment] = match;
  // Next's own files next to the pages (share cards).
  if (/^(opengraph|twitter)-image/.test(segment)) return null;
  if (section === 'dramas') return isHubId(segment) ? null : notFoundPage(req);
  if (section === 'tunisian/tv') return channelBySlug(segment) ? null : notFoundPage(req);

  const code = segment.toLowerCase();
  if (code === 'tn') return NextResponse.redirect(new URL('/tunisian/cinema', req.url), 308);
  if (!isArabCountry(code)) return notFoundPage(req);
  if (code === segment) return null;
  const url = req.nextUrl.clone();
  url.pathname = `/arab-cinema/${code}`;
  return NextResponse.redirect(url, 308);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/') return switchTvMode(req) ?? NextResponse.next();
  // The real 404, 308 and 302 of people's pages (see src/app/u/_lib/gate.ts).
  if (pathname === '/me' || pathname.startsWith('/u/')) return (await profilePageGate(req)) ?? NextResponse.next();
  if (/^\/(arab-cinema|dramas|tunisian\/tv)\//.test(pathname)) return closedSetStatus(req) ?? NextResponse.next();
  if (!AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Redirect logged-in users away from login and signup pages
  if (token && (pathname === '/login' || pathname === '/signup')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users to login page for protected routes
  if (!token && (pathname.startsWith('/dashboard') || pathname === '/profiles')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // '/' only for the ?tv= switch (no session lookup there). `:path*`, not a lone `:param` at the end:
  // Next 14.2 compiles '/u/:handle' to a pattern that only matches '/u'.
  matcher: ['/', '/dashboard', '/login', '/signup', '/profiles', '/me', '/u/:path*', '/arab-cinema/:path*', '/dramas/:path*', '/tunisian/tv/:path*'],
};
