// Pictures the e-mails load from the site, made from the brand files:
//   node scripts/email-assets.mjs
// public/email/wordmark.png: the TunisiaFlicks wordmark in white (in the digest the red CTA pill is
// the only red), drawn at twice the size the e-mails show it (152x20) so it stays sharp on retina
// screens. PNG, because e-mail clients don't draw SVG.
// public/email/mark.png: the red "A" (the site's mark, components/brand/BrandMark), at twice the
// size the account e-mails show it (44x39, src/lib/email-kit.ts) on their card.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'email')

/** The size the e-mail template shows it at (src/lib/digest/template.ts). */
export const WORDMARK = { width: 152, height: 20 }
/** The mark's size in the account e-mails (src/lib/email-kit.ts): the viewBox's 100:88. */
export const MARK = { width: 44, height: 39 }
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

// The mark: the three strokes of BrandMark, in the logo's red.
const strokes = (await readFile(path.join(ROOT, 'src', 'components', 'brand', 'BrandMark.tsx'), 'utf8')).match(/'M[^']+Z'/g)
if (!strokes || strokes.length !== 3) throw new Error('BrandMark strokes not found')
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 6 100 88">${strokes.map((d) => `<path fill="#ff0f00" d="${d.slice(1, -1)}"/>`).join('')}</svg>`
const mark = await sharp(Buffer.from(markSvg), { density: 600 })
  .resize(MARK.width * SCALE, MARK.height * SCALE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer()
await writeFile(path.join(OUT, 'mark.png'), mark)
console.log(`public/email/mark.png ${MARK.width * SCALE}x${MARK.height * SCALE}, ${mark.length} bytes`)
