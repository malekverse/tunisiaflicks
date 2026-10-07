import clientPromise from '@/src/lib/mongodb'

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Finds the account for an email, ignoring case. An exact match wins, so legacy duplicates that
 * only differ by case keep logging in to the account they always did.
 */
export async function findUserByEmail(email: string) {
  const trimmed = email.trim()
  if (!trimmed) return null
  const users = (await clientPromise).db().collection('users')
  return (await users.findOne({ email: trimmed }))
    ?? users.findOne({ email: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' } })
}
