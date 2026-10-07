// Email verification. Signing up (or changing your email) sends a link; opening it marks the
// address as verified. Verification is "soft": unverified accounts still work, they just see a
// reminder banner. Existing accounts (created before this existed) are simply unverified.
//
// Only a SHA-256 hash of the token is stored, so a database leak can't be used to verify emails.
import { createHash, randomBytes } from 'crypto'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { sendVerificationEmail } from '@/src/lib/email'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Issues a fresh link (replacing any previous one) and emails it. Returns whether it was sent. */
export async function startEmailVerification(userId: string | ObjectId, email: string): Promise<boolean> {
  const token = randomBytes(32).toString('hex')
  const client = await clientPromise
  await client.db().collection('users').updateOne(
    { _id: typeof userId === 'string' ? new ObjectId(userId) : userId },
    { $set: { verifyTokenHash: hashToken(token), verifyTokenExpiry: new Date(Date.now() + TOKEN_TTL_MS) } }
  )
  try {
    await sendVerificationEmail(email, token)
    return true
  } catch (error) {
    console.error('Could not send the verification email:', error)
    return false
  }
}

export type VerifyResult = 'verified' | 'already' | 'invalid'

/** Consumes a verification link. */
export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return 'invalid'
  const users = (await clientPromise).db().collection('users')
  const user = await users.findOne(
    { verifyTokenHash: hashToken(token), verifyTokenExpiry: { $gt: new Date() } },
    { projection: { emailVerified: 1 } }
  )
  if (!user) return 'invalid'
  await users.updateOne(
    { _id: user._id },
    { $set: { emailVerified: user.emailVerified ?? new Date() }, $unset: { verifyTokenHash: '', verifyTokenExpiry: '' } }
  )
  return user.emailVerified ? 'already' : 'verified'
}
