"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/src/lib/auth"
import clientPromise from "@/src/lib/mongodb"
import { ObjectId } from "mongodb"
import { Session } from "next-auth"
import { startEmailVerification } from "@/src/lib/verification"
import { escapeRegex } from "@/src/lib/users"

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


/**
 * Returns `{ ok }` or `{ error }` rather than throwing: thrown server-action errors are replaced by
 * a generic message in production, so the form couldn't tell "email taken" apart from a crash.
 */
export async function updateProfile(data: ProfileData): Promise<{ ok: true, emailChanged: boolean } | { error: 'emailTaken' | 'failed' }> {
  const session = await getServerSession(authOptions) as Session | null
  if (!session) {
    throw new Error("You must be logged in to update your profile")
  }

  const client = await clientPromise
  const usersCollection = client.db().collection("users")
  const userId = new ObjectId(session.user.id)
  const update = pickProfileFields(data)

  const current = await usersCollection.findOne({ _id: userId }, { projection: { email: 1 } })
  if (!current) return { error: 'failed' }

  const newEmail = update.email?.trim()
  const emailChanged = !!newEmail && newEmail.toLowerCase() !== String(current.email ?? '').toLowerCase()
  if (emailChanged) {
    // Two accounts must never share a login email.
    const taken = await usersCollection.findOne(
      { _id: { $ne: userId }, email: { $regex: `^${escapeRegex(newEmail!)}$`, $options: 'i' } },
      { projection: { _id: 1 } }
    )
    if (taken) return { error: 'emailTaken' }
  }

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

