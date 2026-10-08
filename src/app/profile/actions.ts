"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/src/lib/auth"
import clientPromise from "@/src/lib/mongodb"
import { ObjectId } from "mongodb"
import { Session } from "next-auth"
import { compare } from "bcrypt"
import { startEmailVerification } from "@/src/lib/verification"
import { escapeRegex } from "@/src/lib/users"
import { rateLimit } from "@/src/lib/rate-limit"
import { isFreshLogin, isLimitedSession } from "@/src/lib/session-scope"

interface ProfileData {
  name?: string
  email?: string
  phone?: string
  birthdate?: string
}

// Only the editable profile fields may be written (never password, reset tokens, etc.)
function pickProfileFields(data: ProfileData): ProfileData {
  const update: ProfileData = {}
  for (const key of ["name", "email", "phone", "birthdate"] as const) {
    if (typeof data?.[key] === "string") update[key] = data[key]
  }
  return update
}

export type UpdateProfileError =
  | 'emailTaken'
  | 'failed'
  /** Changing the email of an account with a password: the current one is missing or wrong. */
  | 'wrongPassword'
  /** Changing the email of a Google-only account: the last sign-in is older than 10 minutes. */
  | 'reauth'
  /** A TV signed in with a code can't change the account. */
  | 'tv_session'
  | 'rateLimited'

/**
 * Returns `{ ok }` or `{ error }` rather than throwing: thrown server-action errors are replaced by
 * a generic message in production, so the form couldn't tell "email taken" apart from a crash.
 *
 * The login email is the key to the account (password resets go there), so changing it needs proof
 * that the person at the keyboard owns the account: the current password, or, for accounts that
 * only sign in with Google, a sign-in in the last 10 minutes.
 */
export async function updateProfile(
  data: ProfileData & { currentPassword?: string }
): Promise<{ ok: true, emailChanged: boolean } | { error: UpdateProfileError }> {
  const session = await getServerSession(authOptions) as Session | null
  if (!session) {
    throw new Error("You must be logged in to update your profile")
  }
  if (isLimitedSession(session)) return { error: 'tv_session' }

  const client = await clientPromise
  const usersCollection = client.db().collection("users")
  const userId = new ObjectId(session.user.id)
  const update = pickProfileFields(data)

  const current = await usersCollection.findOne({ _id: userId }, { projection: { email: 1, password: 1 } })
  if (!current) return { error: 'failed' }

  const newEmail = update.email?.trim()
  // The login email is never blanked (that would lock the account out, with no proof asked), and is
  // stored trimmed.
  if (update.email !== undefined) {
    if (newEmail) update.email = newEmail
    else delete update.email
  }
  const emailChanged = !!newEmail && newEmail.toLowerCase() !== String(current.email ?? '').toLowerCase()
  if (emailChanged) {
    const hasPassword = typeof current.password === 'string' && current.password.length > 0
    if (hasPassword) {
      // Guessing the password through this form is as slow as through the password form.
      const limit = await rateLimit(`email-change:user:${session.user.id}`, 5, 15 * 60)
      if (!limit.ok) return { error: 'rateLimited' }
      const currentPassword = typeof data?.currentPassword === 'string' ? data.currentPassword : ''
      if (!currentPassword || !(await compare(currentPassword, current.password))) return { error: 'wrongPassword' }
    } else if (!isFreshLogin(session)) {
      return { error: 'reauth' }
    }

    // Two accounts must never share a login email.
    const taken = await usersCollection.findOne(
      { _id: { $ne: userId }, email: { $regex: `^${escapeRegex(newEmail!)}$`, $options: 'i' } },
      { projection: { _id: 1 } }
    )
    if (taken) return { error: 'emailTaken' }
  }
  if (Object.keys(update).length === 0) return { ok: true, emailChanged: false }

  const result = await usersCollection.updateOne(
    { _id: userId },
    emailChanged
      ? { $set: { ...update, email: newEmail, emailVerified: null } }
      : { $set: update }
  )
  if (result.matchedCount === 0) return { error: 'failed' }

  // A new address has to be confirmed again.
  if (emailChanged) await startEmailVerification(userId, newEmail!)
  return { ok: true, emailChanged }
}

export async function updateAvatar(avatarDataUrl: string) {
  const session = await getServerSession(authOptions) as Session | null;
  if (!session) {
    throw new Error("You must be logged in to update your avatar");
  }
  if (isLimitedSession(session)) {
    throw new Error("The account photo can't be changed from a TV");
  }

  // Must be an image data URL of a sane size (it is stored in the user's record).
  if (typeof avatarDataUrl !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(avatarDataUrl) || avatarDataUrl.length > 700_000) {
    throw new Error("Invalid avatar image");
  }

  const client = await clientPromise;
  const usersCollection = client.db().collection("users");

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(session.user.id) },
    { $set: { image: avatarDataUrl } }
  );

  if (result.matchedCount === 0) {
    throw new Error("Failed to update avatar");
  }
}
