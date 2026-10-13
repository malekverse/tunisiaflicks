// A film person without a photo (TMDB has none, or it won't load): their initials on a dark tile
// lit in a colour of their own, instead of a stock cartoon. Drawn as SVG, so it fits any frame (a
// 40px search result, a cast circle, the person page's portrait). Deliberately unlike site
// members' avatars (components/social/Avatar: one letter on the profile's solid colour), so film
// people and site people never look alike. Server-safe: no hooks.
import { cn } from '@/src/lib/utils'

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

/**
 * "Latifa Gafsi" → "LG", "Oumayma El Mekki" → "OM", "Cher" → "C". Arabic names get their first
 * letter only: Arabic letters change shape when torn from their word, and two of them read oddly.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const first = (word: string) => Array.from(word)[0] ?? ''
  if (ARABIC.test(words[0])) return first(words[0])
  const letters = words.length > 1 ? first(words[0]) + first(words[words.length - 1]) : first(words[0])
  return letters.toLocaleUpperCase()
}

/** A stable hue (0-359) from a name, so a person always gets the same light. */
export function hueOf(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return hash % 360
}

/** Fills its (positioned) parent, like a `fill` image. */
export default function PersonInitials({ name, className }: { name: string, className?: string }) {
  const hue = hueOf(name)
  const initials = initialsOf(name)
  return (
    <span
      aria-hidden
      className={cn('absolute inset-0 flex select-none items-center justify-center overflow-hidden', className)}
      style={{ background: `radial-gradient(120% 90% at 50% 18%, hsl(${hue} 32% 24%) 0%, hsl(${hue} 22% 12%) 55%, #0b0b0d 100%)` }}
    >
      {/* Light from above, like every surface in the room. */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] via-transparent to-black/30" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="relative h-full max-h-[70%] w-full max-w-[70%]">
        <text
          x="50"
          y="52"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={initials.length > 1 ? 40 : 46}
          fontWeight={700}
          letterSpacing="1"
          fill={`hsl(${hue} 60% 88% / 0.9)`}
          className="font-display"
        >
          {initials}
        </text>
      </svg>
    </span>
  )
}
