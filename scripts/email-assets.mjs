// Pictures the e-mails load from the site, made from the brand files:
//   node scripts/email-assets.mjs
// public/email/wordmark.png: the TunisiaFlicks wordmark in white (in the digest the red CTA pill is
// the only red), drawn at twice the size the e-mails show it (152x20) so it stays sharp on retina
// screens. PNG, because e-mail clients don't draw SVG.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'email')

/** The size the e-mail template shows it at (src/lib/digest/template.ts). */
export const WORDMARK = { width: 152, height: 20 }
const SCALE = 2

const svg = (await readFile(path.join(ROOT, 'public', 'TunisiaFlicks.svg'), 'utf8'))
  .replace(/fill="#[0-9a-f]{3,8}"/gi, 'fill="#ffffff"')

await mkdir(OUT, { recursive: true })
const png = await sharp(Buffer.from(svg), { density: 600 })
  .resize(WORDMARK.width * SCALE, WORDMARK.height * SCALE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, palette: true })
  .toBuffer()
await writeFile(path.join(OUT, 'wordmark.png'), png)
console.log(`public/email/wordmark.png ${WORDMARK.width * SCALE}x${WORDMARK.height * SCALE}, ${png.length} bytes`)
