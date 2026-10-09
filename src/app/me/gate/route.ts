// /me/gate: where /me sends this visitor (their page, when the profile has one), for the
// middleware, which turns it into a real 302 (see src/app/u/_lib/gate.ts). Internal: without the
// middleware's token it is a plain 404.
import { gateToken, sameToken, GATE_HEADER, type GateAnswer } from '@/src/app/u/_lib/gate'
import { pageViewer } from '@/src/app/friends/_lib/viewer'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || !sameToken(req.headers.get(GATE_HEADER), await gateToken(secret))) return new Response(null, { status: 404 })
  const viewer = await pageViewer().catch(() => null)
  const answer: GateAnswer = viewer?.kind === 'member' && viewer.social?.handle ? { kind: 'redirect', to: viewer.social.handle } : { kind: 'page' }
  return Response.json(answer, { headers: { 'Cache-Control': 'private, no-store' } })
}
