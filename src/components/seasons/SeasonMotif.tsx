import { cn } from '@/src/lib/utils'

// The season's motif, drawn in thin lines of its accent: a lantern hanging beside a crescent for
// Ramadan and the Eids, a few slow sparkles for New Year. Only inside the seasonal banner and the
// moment pages, never in the navigation chrome. Inline SVG, no images; the sparkles are CSS only
// and are not drawn at all for people who ask for less motion.

/** The crescent: two circles' difference, its horns opening toward the upper end. */
const CRESCENT = 'M159.74 108.48A34 34 0 1 1 117.61 60.34A32 32 0 1 0 159.74 108.48Z'

/** A four-pointed sparkle of radius 1, scaled where it is used. */
const SPARKLE = 'M0 -1C0.12 -0.3 0.3 -0.12 1 0C0.3 0.12 0.12 0.3 0 1C-0.12 0.3 -0.3 0.12 -1 0C-0.3 -0.12 -0.12 -0.3 0 -1Z'

/** Where the New Year sparkles sit (x, y, size) and when each one twinkles. */
const SPARKLES = [
  { x: 112, y: 30, r: 8, delay: 0, duration: 3.6 },
  { x: 64, y: 62, r: 10, delay: 1.2, duration: 4.4 },
  { x: 126, y: 86, r: 6, delay: 2.3, duration: 3.9 },
  { x: 32, y: 26, r: 5, delay: 0.7, duration: 4.6 },
  { x: 92, y: 104, r: 4, delay: 1.8, duration: 4.1 },
  { x: 160, y: 66, r: 4.5, delay: 2.9, duration: 3.7 },
]

/** The phone's corner: three of them in a small square, clear of the X above and the text beside. */
const CORNER_SPARKLES = [
  { x: 20, y: 22, r: 7, delay: 0.4, duration: 3.8 },
  { x: 52, y: 40, r: 5, delay: 1.6, duration: 4.3 },
  { x: 34, y: 57, r: 3.5, delay: 2.6, duration: 3.6 },
]

const TWINKLE_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes tf-twinkle { 0%, 100% { opacity: 0.18; transform: scale(0.72) } 50% { opacity: 1; transform: scale(1) } }
  .tf-twinkle { transform-box: fill-box; transform-origin: center; animation: tf-twinkle var(--twinkle-duration, 4s) ease-in-out var(--twinkle-delay, 0s) infinite both; }
}
`

function Lantern({ accent, id }: { accent: string, id: string }) {
  return (
    <g>
      {/* The flame's glow: the only filled thing in the drawing. */}
      <circle cx="56" cy="70" r="16" fill={`url(#${id}-flame)`} />
      <path d="M56 70c2.6-3 2.8-6.2 0-9.6c-2.8 3.4-2.6 6.6 0 9.6Z" fill={`rgb(${accent} / 0.55)`} stroke="none" />
      <g fill="none" stroke={`rgb(${accent})`}>
        <path d="M56 0V28" />
        <circle cx="56" cy="31" r="3" />
        <path d="M47 44Q47 35.5 56 34Q65 35.5 65 44" />
        <path d="M44 44H68" />
        <path d="M44 44L40 56V78L46 90H66L72 78V56L68 44" />
        <path d="M40 56H72M40 78H72" />
        <path d="M47 76V65C47 61.5 49.5 59.5 51 57.5C52.5 59.5 55 61.5 55 65V76" />
        <path d="M57 76V65C57 61.5 59.5 59.5 61 57.5C62.5 59.5 65 61.5 65 65V76" />
        <path d="M46 90L49 96H63L66 90M56 96V101" />
      </g>
    </g>
  )
}

/** Each variant's window onto the drawing: the corner one is the crescent alone (or its own sparkles). */
const VIEW = { banner: '0 0 180 120', page: '0 0 180 120', corner: '88 50 84 70' } as const
const CORNER_SPARKLES_VIEW = '0 0 70 70'

/**
 * `variant="banner"` fills the end of the seasonal banner on wider screens (the lantern hangs from
 * its top edge); `variant="corner"` is the phone's version, just the crescent rising in the bottom
 * end corner (or three sparkles there); `variant="page"` is the large drawing behind a moment page's title. In Arabic the
 * drawing mirrors, so the lantern stays clear of the X in the top end corner. Null for moments
 * without one.
 */
export default function SeasonMotif({ id, accent, variant = 'banner', className }: {
  id: string
  accent: string
  variant?: 'banner' | 'page' | 'corner'
  className?: string
}) {
  const lantern = id === 'ramadan' || id === 'eid-al-fitr' || id === 'eid-al-adha'
  const sparkles = id === 'new-year'
  if (!lantern && !sparkles) return null
  const svgId = `season-motif-${variant}-${id}`
  const strokeWidth = variant === 'page' ? 0.9 : variant === 'corner' ? 1.6 : 1.3

  return (
    <svg
      aria-hidden
      viewBox={sparkles && variant === 'corner' ? CORNER_SPARKLES_VIEW : VIEW[variant]}
      preserveAspectRatio={variant === 'corner' ? 'xMaxYMax meet' : 'xMaxYMin meet'}
      className={cn('pointer-events-none rtl:-scale-x-100', sparkles && 'motion-reduce:hidden', className)}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {lantern && (
        <>
          {variant !== 'corner' && (
            <>
              <defs>
                <radialGradient id={`${svgId}-flame`}>
                  <stop offset="0" stopColor={`rgb(${accent})`} stopOpacity="0.45" />
                  <stop offset="1" stopColor={`rgb(${accent})`} stopOpacity="0" />
                </radialGradient>
              </defs>
              <Lantern accent={accent} id={svgId} />
            </>
          )}
          <path d={CRESCENT} fill="none" stroke={`rgb(${accent})`} />
        </>
      )}
      {sparkles && (
        <>
          <style>{TWINKLE_CSS}</style>
          {(variant === 'corner' ? CORNER_SPARKLES : SPARKLES).map((sparkle, index) => (
            // The group places it; the path twinkles (a CSS transform would replace the attribute).
            <g key={index} transform={`translate(${sparkle.x} ${sparkle.y}) scale(${sparkle.r})`}>
              <path
                d={SPARKLE}
                className="tf-twinkle"
                fill={`rgb(${accent})`}
                style={{ '--twinkle-delay': `${sparkle.delay}s`, '--twinkle-duration': `${sparkle.duration}s` } as React.CSSProperties}
              />
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
