// For src/middleware.ts: the real 404, 308 and 302 of /u/[handle] and /me (see ./gate.ts for why
// and how):
//   if (pathname === '/me' || pathname.startsWith('/u/')) return (await profilePageGate(req)) ?? NextResponse.next()
//   matcher: [..., '/me', '/u/:handle']
import { NextResponse, type NextRequest } from 'next/server'
import { decideProfileGate } from './gate'

export async function profilePageGate(req: NextRequest): Promise<NextResponse | null> {
  const decision = await decideProfileGate({ method: req.method, pathname: req.nextUrl.pathname, origin: req.nextUrl.origin, headers: req.headers })
  if (!decision) return null
  // The app's own 404 page, the address kept as typed.
  if (decision.kind === 'not_found') return NextResponse.rewrite(new URL('/404', req.nextUrl.origin))
  const url = req.nextUrl.clone()
  url.pathname = `/u/${decision.to}`
  return NextResponse.redirect(url, decision.status)
}
