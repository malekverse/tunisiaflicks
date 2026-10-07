"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/src/lib/auth"
import clientPromise from "@/src/lib/mongodb"
import { ObjectId } from "mongodb"
import { Session } from "next-auth"

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

export async function updateProfile(data: ProfileData) {
  const session = await getServerSession(authOptions) as Session | null
  if (!session) {
    throw new Error("You must be logged in to update your profile")
  }

  const client = await clientPromise
  const usersCollection = client.db().collection("users")

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(session.user.id) },
    { $set: pickProfileFields(data) }
  )

  if (result.matchedCount === 0) {
    throw new Error("Failed to update profile")
  }
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

