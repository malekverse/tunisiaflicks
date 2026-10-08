"use client"
import LibraryCollection from '@/src/components/library/LibraryCollection'

// Watch history: everything this profile watched, grouped by day. Signed out: an invitation to sign in.
export default function WatchHistoryPage() {
  return <LibraryCollection kind="history" />
}
