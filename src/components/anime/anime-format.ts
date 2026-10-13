// Small helpers the anime components share (client-safe, no React).
import type { Locale } from '@/src/lib/i18n/locales'

/** '#e49335' → '228 147 53' (the room light and the ambient glow take an RGB triplet). */
export function hexToTriplet(hex: string | null | undefined): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!match) return null
  const value = parseInt(match[1], 16)
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
}

/** How long until a moment, compact and in the viewer's language: '2d 4h', '3h 12m', '45m', '<1m'. */
export function untilText(seconds: number, locale: Locale): string {
  const unit = (value: number, name: 'day' | 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(value)
  if (seconds < 60) return unit(1, 'minute')
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return hours > 0 ? `${unit(days, 'day')} ${unit(hours, 'hour')}` : unit(days, 'day')
  if (hours > 0) return minutes > 0 ? `${unit(hours, 'hour')} ${unit(minutes, 'minute')}` : unit(hours, 'hour')
  return unit(minutes, 'minute')
}

/** A moment (seconds since 1970) as a day and time in the viewer's own time zone. */
export function airTime(seconds: number, locale: Locale, options: Intl.DateTimeFormatOptions = { weekday: 'short', hour: '2-digit', minute: '2-digit' }): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(seconds * 1000))
}
