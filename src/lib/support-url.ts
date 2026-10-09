// Where "Buy us a coffee" goes: NEXT_PUBLIC_SUPPORT_URL (the Ko-fi page), when it is an https URL.
// Null otherwise, and then /support shows that support isn't open yet, the footer and the sitemap
// leave it out. Client-safe (a public variable, inlined at build time).

export function supportUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
