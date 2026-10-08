"use client"
import LibraryCollection from '@/src/components/library/LibraryCollection'

// Favorites: the titles this profile loves. Signed out: an invitation to sign in.
export default function FavoritesPage() {
  return <LibraryCollection kind="favorites" />
}
