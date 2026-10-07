// Contact form and DMCA notices. Every message is stored in MongoDB first (so nothing is lost if
// email delivery fails) and then forwarded to the owner's CONTACT_EMAIL.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/src/lib/auth'
import clientPromise from '@/src/lib/mongodb'
import { sendContactEmail, type ContactMessage } from '@/src/lib/email'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { CONTACT_TOPICS } from '@/src/lib/contact'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export async function POST(request: Request) {
  const limit = await rateLimit(`contact:ip:${clientIp(request.headers)}`, 5, 60 * 60)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // Honeypot: a hidden field real people never fill. Pretend it worked so bots don't adapt.
  if (text(body?.website, 200)) return NextResponse.json({ ok: true })

  const kind = body?.kind === 'dmca' ? 'dmca' : 'contact'
  const msg: ContactMessage = {
    kind,
    name: text(body?.name, 100),
    email: text(body?.email, 200),
    message: text(body?.message, 5000),
  }

  const errors: string[] = []
  if (msg.name.length < 2) errors.push('name')
  if (!EMAIL_RE.test(msg.email)) errors.push('email')
  if (msg.message.length < 10) errors.push('message')

  if (kind === 'contact') {
    const topic = text(body?.topic, 20)
    msg.topic = (CONTACT_TOPICS as readonly string[]).includes(topic) ? topic : 'general'
  } else {
    msg.work = text(body?.work, 1000)
    msg.urls = text(body?.urls, 2000)
    msg.signature = text(body?.signature, 100)
    if (msg.work.length < 3) errors.push('work')
    if (msg.urls.length < 5) errors.push('urls')
    if (msg.signature.length < 2) errors.push('signature')
    if (body?.goodFaith !== true) errors.push('goodFaith')
    if (body?.accurate !== true) errors.push('accurate')
  }

  if (errors.length) return NextResponse.json({ error: 'invalid', fields: errors }, { status: 400 })

  try {
    const session = await getServerSession(authOptions)
    const client = await clientPromise
    await client.db().collection('contactMessages').insertOne({
      ...msg,
      userId: session?.user?.id ?? null,
      status: 'new',
      createdAt: new Date(),
    })
  } catch (error) {
    console.error('Error saving contact message:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }

  // Stored already: an email hiccup shouldn't make the sender retry (and duplicate the message).
  // Awaited, because a serverless function may be frozen as soon as the response is sent.
  try {
    await sendContactEmail(msg)
  } catch (error) {
    console.error('Error emailing contact message (kept in contactMessages):', error)
  }

  return NextResponse.json({ ok: true })
}
