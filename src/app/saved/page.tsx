"use client"
import LibraryCollection from '@/src/components/library/LibraryCollection'

// Saved for later: titles this profile wants to watch. Signed out: an invitation to sign in.
export default function SavedItemsPage() {
  return <LibraryCollection kind="saved" />
}
