// The ambient colour of a picture ('r g b'), the same one the site lights the room with
// (lib/ambient), worked out on the server with sharp so the e-mail's hero can be tinted by it.
import { dominantColor } from '@/src/lib/ambient'

const cache = new Map<string, Promise<string | null>>()
const MAX_CACHED = 500

/** A TMDB poster path's colour (small w92 version), or null when it has none worth glowing. */
export function pictureColor(posterPath: string | null | undefined): Promise<string | null> {
  if (!posterPath || !posterPath.startsWith('/')) return Promise.resolve(null)
  let pending = cache.get(posterPath)
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(`https://image.tmdb.org/t/p/w92${posterPath}`, { signal: AbortSignal.timeout(3000) })
        if (!response.ok) return null
        const sharp = (await import('sharp')).default
        const pixels = await sharp(Buffer.from(await response.arrayBuffer())).resize(32, 48, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
        return dominantColor(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length))
      } catch {
        return null
      }
    })()
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string)
    cache.set(posterPath, pending)
  }
  return pending
}
