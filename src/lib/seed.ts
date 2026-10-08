// Deterministic "randomness" from a string (usually today's date): every server and every request
// of the day agrees, nothing needs storing, and tomorrow brings a new draw.

/** FNV-1a: a small, stable string hash. */
export function hash(value: string) {
  let result = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 0x01000193)
  }
  return result >>> 0
}

/** The same shuffle for the same seed (Fisher-Yates driven by xorshift, seeded by the hash). */
export function shuffled<T>(items: T[], seed: string): T[] {
  const result = [...items]
  let state = hash(seed) || 1
  for (let i = result.length - 1; i > 0; i--) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    const j = state % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
