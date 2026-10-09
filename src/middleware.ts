import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TV_COOKIE } from '@/src/lib/tv-mode';
import { profilePageGate } from '@/src/app/u/_lib/middleware-gate';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Pages whose access depends on being signed in (the only ones that need the session token). */
const AUTH_PATHS = ['/dashboard', '/login', '/signup', '/profiles'];

/**
 * TV mode is a cookie, switched from the home page: /?tv=1 turns it on (the Android TV app starts
 * there), /?tv=0 turns it off. Either way the visitor lands on / with the other parameters kept.
 * Not httpOnly: the TV settings read it to show the switch's state.
 */
function switchTvMode(req: NextRequest): NextResponse | null {
  const value = req.nextUrl.searchParams.get('tv');
  if (value !== '1' && value !== '0') return null;

  const url = req.nextUrl.clone();
  url.searchParams.delete('tv');
  const response = NextResponse.redirect(url);
  if (value === '1') {
    response.cookies.set(TV_COOKIE, '1', {
      path: '/',
      maxAge: ONE_YEAR,
      sameSite: 'lax',
      httpOnly: false,
      secure: req.nextUrl.protocol === 'https:',
    });
  } else {
    response.cookies.delete(TV_COOKIE);
  }
  return response;
}

/**
 * The Arab cinema map's addresses: a country is a lowercase ISO code, so /arab-cinema/EG is a real
 * 308 to /arab-cinema/eg, and Tunisia's page is /tunisian/cinema. (Pages stream from the root
 * loading.tsx, so a redirect inside the page could only be a 200 with a meta refresh.)
 */
function arabCinemaRedirect(req: NextRequest): NextResponse | null {
  const match = /^\/arab-cinema\/([A-Za-z]{2})\/?$/.exec(req.nextUrl.pathname);
  if (!match) return null;
  const code = match[1].toLowerCase();
  if (code === 'tn') return NextResponse.redirect(new URL('/tunisian/cinema', req.url), 308);
  if (code === match[1]) return null;
  const url = req.nextUrl.clone();
  url.pathname = `/arab-cinema/${code}`;
  return NextResponse.redirect(url, 308);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/') return switchTvMode(req) ?? NextResponse.next();
  // The real 404, 308 and 302 of people's pages (see src/app/u/_lib/gate.ts).
  if (pathname === '/me' || pathname.startsWith('/u/')) return (await profilePageGate(req)) ?? NextResponse.next();
  if (pathname.startsWith('/arab-cinema/')) return arabCinemaRedirect(req) ?? NextResponse.next();
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
  // '/' only for the ?tv= switch (no session lookup there).
  matcher: ['/', '/dashboard', '/login', '/signup', '/profiles', '/me', '/u/:handle', '/arab-cinema/:country'],
};
