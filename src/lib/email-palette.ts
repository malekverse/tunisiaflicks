// The e-mails' colours and type, one place for all of them (the weekly digest, the account e-mails):
// the site's true black, white at the strengths the site uses (flattened on black, since e-mail
// clients don't do transparency well), one red, and system fonts (no web fonts in e-mail).

export const BLACK = '#000000'
export const SURFACE = '#0b0b0b'
export const HAIRLINE = '#242424'
export const WHITE = '#ffffff'
/** white/70 */
export const SECONDARY = '#b3b3b3'
/** white/55, never fainter */
export const TERTIARY = '#8c8c8c'
/** The CTA pill, the only red thing in an e-mail. */
export const RED = '#e50f05'
/** The logo's red, as 'r g b' (for tints). */
export const BRAND_RGB: [number, number, number] = [255, 15, 0]

export const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans Arabic', Tahoma, sans-serif`

/** `color` mixed into `base` at `amount` (0..1), as #rrggbb. */
export function mix(color: [number, number, number], base: [number, number, number], amount: number) {
  return `#${color.map((value, i) => Math.round(base[i] + (value - base[i]) * amount).toString(16).padStart(2, '0')).join('')}`
}
