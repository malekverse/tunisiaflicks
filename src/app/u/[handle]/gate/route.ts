// /u/[handle]/gate: what the page would answer this visitor (shown, not found, or a permanent
// redirect to the current handle), for the middleware, which turns it into a real 404 or 308 (see
// ../../_lib/gate.ts). Internal: without the middleware's token it is a plain 404, so it can't be
// used to look up handles past the page's own rules. A guest's view is checked against the limit
// here, never counted (the page counts it).
import { gateToken, sameToken, GATE_HEADER, GATE_IP_HEADER } from '../../_lib/gate'
import { gateView } from '../data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { handle: string } }) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || !sameToken(req.headers.get(GATE_HEADER), await gateToken(secret))) return new Response(null, { status: 404 })
  const answer = await gateView(params.handle, req.headers.get(GATE_IP_HEADER) ?? 'unknown')
  return Response.json(answer, { headers: { 'Cache-Control': 'private, no-store' } })
}
