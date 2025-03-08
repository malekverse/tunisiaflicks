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

export async function updateProfile(data: ProfileData) {
  const session = await getServerSession(authOptions) as Session | null
  if (!session) {
    throw new Error("You must be logged in to update your profile")
  }

  const client = await clientPromise
  const usersCollection = client.db().collection("users")

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(session.user.id) },
    { $set: data }
  )

  if (result.modifiedCount === 0) {
    throw new Error("Failed to update profile")
  }
}

export async function updateAvatar(avatarDataUrl: string) {
  const session = await getServerSession(authOptions) as Session | null;
  if (!session) {
    throw new Error("You must be logged in to update your avatar");
  }

  const client = await clientPromise;
  const usersCollection = client.db().collection("users");

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(session.user.id) },
    { $set: { image: avatarDataUrl } }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Failed to update avatar");
  }
}

