// POST /api/supporters/webhook: Ko-fi's call for every coffee (a form post with a JSON `data`
// field). Register https://tunisiaflicks.vercel.app/api/supporters/webhook in Ko-fi's settings.
//
// 404 until KOFI_VERIFICATION_TOKEN and SUPPORT_HASH_SECRET are both set; 429 past 120 calls a
// minute from one IP; 400 for a bad or oversized (64KB) body; 401 when the token doesn't match.
// Once the token matches the answer is always 200 (Ko-fi retries anything else), even when the
// event was already seen or matches nobody. Nothing about the payer is logged.
import { NextResponse } from 'next/server'
import { MAX_WEBHOOK_BYTES, parseKofiBody, processKofi, supportSecrets, tokenMatches } from '@/src/lib/support'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

const answer = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** The body as text, or null past the size limit (read in chunks, never all at once). */
async function readLimited(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_WEBHOOK_BYTES) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_WEBHOOK_BYTES) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function POST(request: Request) {
  const secrets = supportSecrets()
  if (!secrets) return answer(404, { error: 'Not found' })

  const limit = await rateLimit(`kofi:ip:${clientIp(request.headers)}`, 120, 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const raw = await readLimited(request).catch(() => null)
  const payload = raw === null ? null : parseKofiBody(raw)
  if (!payload) return answer(400, { error: 'Bad request' })
  if (!tokenMatches(payload.verification_token, secrets.token)) return answer(401, { error: 'Unauthorized' })

  try {
    const result = await processKofi(payload, secrets.hashSecret)
    return answer(200, { ok: true, result })
  } catch (error) {
    // Only the error's kind: never the payload (it holds an e-mail).
    console.error('Ko-fi webhook: processing failed', error instanceof Error ? error.name : 'unknown')
    return answer(200, { ok: true, result: 'error' })
  }
}

export function GET() {
  return answer(supportSecrets() ? 405 : 404, { error: supportSecrets() ? 'Method not allowed' : 'Not found' })
}
