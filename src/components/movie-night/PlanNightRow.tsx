// STUB: implemented by movie-night in wave 2; keep the signature
// The ShareSheet's "Plan a movie night" row for a title (to /movie-night/new?title=type:id). Null for
// guests and Kids. `onDone` closes the sheet.
"use client"
import type { ShareMedia } from '@/src/lib/social/types'

export default function PlanNightRow(props: { media: ShareMedia; onDone: () => void }): JSX.Element | null {
  void props
  return null
}
