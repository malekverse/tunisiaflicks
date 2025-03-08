import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Redirect logged-in users away from login and signup pages
  if (token && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users to login page for protected routes
  if (!token && req.nextUrl.pathname.startsWith('/dashboard')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/login', '/signup'], // Protect these routes
};