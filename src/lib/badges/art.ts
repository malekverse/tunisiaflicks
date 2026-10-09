// The badge medallions, drawn as SVG text: one drawing for the shelf (inline), the dialog and the
// inbox (/badges/art/{id}-{level}.svg). A near-black disc in a metal rim (bronze, silver, gold,
// platinum), the badge's line glyph in the same metal, and one to four small pips for the level, so
// the tier reads without colour too. Locked: a faint outline, and in 'Up next' an arc showing how
// far along the next level is, in that level's metal. No emoji, no raster, no red. Pure.
import { TIER_RGB, tierOf, type BadgeId, type Level, type Tier } from './catalogue'

type IconNode = [tag: 'path' | 'circle' | 'rect' | 'line', attrs: Record<string, string>][]

// Lucide glyphs (ISC licence), 24x24, stroke-drawn.
const GLYPHS: Record<BadgeId, IconNode> = {
  openingNight: [
    ['path', { d: 'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z' }],
    ['path', { d: 'm6.2 5.3 3.1 3.9' }],
    ['path', { d: 'm12.4 3.4 3.1 4' }],
    ['path', { d: 'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' }],
  ],
  marathon: [
    ['path', { d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z' }],
    ['path', { d: 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12' }],
    ['path', { d: 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' }],
  ],
  nightOwl: [
    ['path', { d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }],
  ],
  earlyBird: [
    ['path', { d: 'M12 2v8' }],
    ['path', { d: 'm4.93 10.93 1.41 1.41' }],
    ['path', { d: 'M2 18h2' }],
    ['path', { d: 'M20 18h2' }],
    ['path', { d: 'm19.07 10.93-1.41 1.41' }],
    ['path', { d: 'M22 22H2' }],
    ['path', { d: 'm8 6 4-4 4 4' }],
    ['path', { d: 'M16 18a4 4 0 0 0-8 0' }],
  ],
  ramadan: [
    ['path', { d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9' }],
    ['path', { d: 'M20 3v4' }],
    ['path', { d: 'M22 5h-4' }],
  ],
  tunisian: [
    ['path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }],
    ['line', { x1: '4', x2: '4', y1: '22', y2: '15' }],
  ],
  genres: [
    ['path', { d: 'M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z' }],
    ['rect', { x: '3', y: '14', width: '7', height: '7', rx: '1' }],
    ['circle', { cx: '17.5', cy: '17.5', r: '3.5' }],
  ],
  world: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }],
    ['path', { d: 'M2 12h20' }],
  ],
  decades: [
    ['path', { d: 'M5 22h14' }],
    ['path', { d: 'M5 2h14' }],
    ['path', { d: 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22' }],
    ['path', { d: 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2' }],
  ],
  finisher: [
    ['path', { d: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6' }],
    ['path', { d: 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18' }],
    ['path', { d: 'M4 22h16' }],
    ['path', { d: 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22' }],
    ['path', { d: 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22' }],
    ['path', { d: 'M18 2H6v7a6 6 0 0 0 12 0V2Z' }],
  ],
  streakWeeks: [
    ['path', { d: 'M8 2v4' }],
    ['path', { d: 'M16 2v4' }],
    ['rect', { width: '18', height: '18', x: '3', y: '4', rx: '2' }],
    ['path', { d: 'M3 10h18' }],
    ['path', { d: 'm9 16 2 2 4-4' }],
  ],
  supporter: [
    ['path', { d: 'M10 2v2' }],
    ['path', { d: 'M14 2v2' }],
    ['path', { d: 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1' }],
    ['path', { d: 'M6 2v2' }],
  ],
}

const DISC = '#0B0B0D'

const rgbOf = (tier: Tier) => TIER_RGB[tier].split(' ').map(Number) as [number, number, number]
const mix = ([r, g, b]: [number, number, number], toward: number, amount: number) =>
  `rgb(${[r, g, b].map((c) => Math.round(c + (toward - c) * amount)).join(',')})`

const attr = (attrs: Record<string, string | number>) =>
  Object.entries(attrs).map(([key, value]) => `${key}="${String(value).replace(/[&"<>]/g, '')}"`).join(' ')

function glyph(id: BadgeId, stroke: string, width: number, opacity = 1): string {
  const shapes = GLYPHS[id].map(([tag, attrs]) => `<${tag} ${attr(attrs)}/>`).join('')
  const faded = opacity < 1 ? ` stroke-opacity="${opacity}"` : ''
  return `<g transform="translate(20 17)" fill="none" stroke="${stroke}"${faded} stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`
}

/** The glyph's line weight for the size it is shown at (thinner when big, so it stays a line). */
const strokeFor = (size: number) => (size <= 48 ? 2.2 : size <= 96 ? 2 : 1.6)

export type BadgeArtOptions = {
  id: BadgeId
  level: number
  /** Rendered size in px (44, 64, 160): sets the line weight. */
  size?: number
  /** Locked art only: how far along the next level is (0..1), drawn as an arc. */
  progress?: number
  /** The arc's metal (the level being worked towards). */
  arcTier?: Tier | null
  /** Prefix for the gradients' ids (several medallions on one page). */
  uid?: string
  /** Standalone file: adds the xmlns. */
  standalone?: boolean
}

/** One medallion as SVG markup (64x64 viewBox). */
export function badgeSvg(o: BadgeArtOptions): string {
  const size = o.size ?? 64
  const level = Math.max(0, Math.min(4, Math.floor(o.level))) as Level
  const tier = tierOf(level)
  const uid = (o.uid ?? `b-${o.id}-${level}`).replace(/[^A-Za-z0-9_-]/g, '')
  const open = `<svg ${o.standalone ? 'xmlns="http://www.w3.org/2000/svg" ' : ''}viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false">`
  const width = strokeFor(size)

  if (!tier) {
    const parts = [
      `<circle cx="32" cy="32" r="31" fill="${DISC}"/>`,
      `<circle cx="32" cy="32" r="29.5" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="1.5"/>`,
      glyph(o.id, '#FFFFFF', width, 0.2),
    ]
    const progress = typeof o.progress === 'number' && Number.isFinite(o.progress) ? Math.max(0, Math.min(1, o.progress)) : 0
    if (progress > 0 && o.arcTier) {
      const circumference = 2 * Math.PI * 29.5
      const length = Math.max(1.5, circumference * progress)
      parts.push(`<circle cx="32" cy="32" r="29.5" fill="none" stroke="${mix(rgbOf(o.arcTier), 255, 0.1)}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${length.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 32 32)"/>`)
    }
    return `${open}${parts.join('')}</svg>`
  }

  const base = rgbOf(tier)
  const metal = mix(base, 255, 0.12)
  const pips = Array.from({ length: level }, (_, index) => {
    const x = 32 + (index - (level - 1) / 2) * 4.2
    return `<circle cx="${x.toFixed(2)}" cy="50.5" r="1.15" fill="${metal}"/>`
  }).join('')
  return `${open}<defs>`
    + `<linearGradient id="${uid}-rim" x1="0.15" y1="0" x2="0.85" y2="1">`
    + `<stop offset="0" stop-color="${mix(base, 255, 0.45)}"/>`
    + `<stop offset="0.32" stop-color="${mix(base, 255, 0.05)}"/>`
    + `<stop offset="0.62" stop-color="${mix(base, 0, 0.42)}"/>`
    + `<stop offset="1" stop-color="${mix(base, 255, 0.18)}"/>`
    + `</linearGradient>`
    + `<radialGradient id="${uid}-face" cx="0.5" cy="0.32" r="0.75">`
    + `<stop offset="0" stop-color="#17171B"/><stop offset="1" stop-color="${DISC}"/>`
    + `</radialGradient>`
    + `</defs>`
    + `<circle cx="32" cy="32" r="31" fill="url(#${uid}-rim)"/>`
    + `<circle cx="32" cy="32" r="27.25" fill="url(#${uid}-face)"/>`
    + `<circle cx="32" cy="32" r="27.25" fill="none" stroke="${mix(base, 0, 0.55)}" stroke-width="0.75"/>`
    + `<circle cx="32" cy="32" r="25.5" fill="none" stroke="${mix(base, 255, 0.2)}" stroke-opacity="0.16" stroke-width="0.6"/>`
    // Platinum: a second bezel line in the rim, so it doesn't pass for silver.
    + (level === 4 ? `<circle cx="32" cy="32" r="29.4" fill="none" stroke="${mix(base, 0, 0.35)}" stroke-opacity="0.7" stroke-width="0.6"/>` : '')
    + glyph(o.id, metal, width)
    + pips
    + `</svg>`
}
