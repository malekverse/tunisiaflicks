// The remote's rules, without the DOM (unit-tested in tests/tv-mode.unit.test.mjs):
// - normalizeKey: what a key press means, across Android TV, Fire TV, webOS, Tizen and keyboards;
// - beamScore / pickBest: where an arrow goes (a spatial "beam" search, as on TV platforms).

export type TvKey =
  | 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'
  | 'playPause' | 'play' | 'pause' | 'stop' | 'rewind' | 'fastForward'
  | 'menu' | 'channelUp' | 'channelDown'

export type Direction = 'up' | 'down' | 'left' | 'right'

export const isDirection = (key: TvKey | null): key is Direction => key === 'up' || key === 'down' || key === 'left' || key === 'right'

type KeyLike = { key?: string; keyCode?: number; which?: number }

const BY_NAME: Record<string, TvKey> = {
  ArrowUp: 'up', Up: 'up',
  ArrowDown: 'down', Down: 'down',
  ArrowLeft: 'left', Left: 'left',
  ArrowRight: 'right', Right: 'right',
  Enter: 'ok', Select: 'ok', Accept: 'ok',
  Escape: 'back', Esc: 'back', BrowserBack: 'back', GoBack: 'back',
  MediaPlayPause: 'playPause', MediaPlay: 'play', MediaPause: 'pause', MediaStop: 'stop',
  MediaRewind: 'rewind', MediaFastForward: 'fastForward',
  ContextMenu: 'menu',
  ChannelUp: 'channelUp', ChannelDown: 'channelDown', PageUp: 'channelUp', PageDown: 'channelDown',
}

const BY_CODE: Record<number, TvKey> = {
  38: 'up', 40: 'down', 37: 'left', 39: 'right',
  13: 'ok', 23: 'ok',                       // Enter; Android DPAD_CENTER
  27: 'back', 4: 'back', 461: 'back', 10009: 'back', 166: 'back', // Escape; Android BACK; webOS; Tizen RETURN; BrowserBack
  179: 'playPause', 415: 'play', 19: 'pause', 413: 'stop', 412: 'rewind', 417: 'fastForward',
  82: 'menu', 93: 'menu',                   // Android MENU; ContextMenu
  427: 'channelUp', 428: 'channelDown', 33: 'channelUp', 34: 'channelDown',
}

/**
 * What a key press means on a TV, or null. `typing`: the focus is in a text field, where
 * Backspace deletes (it is Back only outside fields; some remotes send 8 for Back).
 */
export function normalizeKey(event: KeyLike, typing = false): TvKey | null {
  const name = event.key
  if (name === 'Backspace') return typing ? null : 'back'
  if (name && name !== 'Unidentified' && BY_NAME[name]) return BY_NAME[name]
  const code = event.keyCode || event.which || 0
  if (code === 8) return typing ? null : 'back'
  // A key name we know nothing about wins over its code (a letter is not a remote key).
  if (name && name.length === 1) return null
  return BY_CODE[code] ?? null
}

export type Rect = { left: number; top: number; right: number; bottom: number }

/** Inside the beam: weight of the sideways distance. Outside: much heavier, so aligned items win. */
export const IN_BEAM_WEIGHT = 0.3
export const OUT_OF_BEAM_WEIGHT = 2

/**
 * How far `to` is from `from` going `direction` (lower is better), or null when `to` isn't that
 * way. score = primary distance + 0.3·sideways distance inside the beam (the strip `from` covers),
 * + 2·sideways distance outside it.
 */
export function beamScore(from: Rect, to: Rect, direction: Direction): number | null {
  const horizontal = direction === 'left' || direction === 'right'
  const fromCenter = horizontal ? (from.top + from.bottom) / 2 : (from.left + from.right) / 2
  const toCenter = horizontal ? (to.top + to.bottom) / 2 : (to.left + to.right) / 2
  const fromMain = horizontal ? (from.left + from.right) / 2 : (from.top + from.bottom) / 2
  const toMain = horizontal ? (to.left + to.right) / 2 : (to.top + to.bottom) / 2

  // Must lie that way: its centre past ours, and not starting behind our far edge.
  let primary: number
  switch (direction) {
    case 'right': if (toMain <= fromMain || to.right <= from.right) return null; primary = to.left - from.right; break
    case 'left': if (toMain >= fromMain || to.left >= from.left) return null; primary = from.left - to.right; break
    case 'down': if (toMain <= fromMain || to.bottom <= from.bottom) return null; primary = to.top - from.bottom; break
    case 'up': if (toMain >= fromMain || to.top >= from.top) return null; primary = from.top - to.bottom; break
  }
  primary = Math.max(0, primary)

  const inBeam = horizontal
    ? to.top < from.bottom && to.bottom > from.top
    : to.left < from.right && to.right > from.left
  const sideways = Math.abs(toCenter - fromCenter)
  return primary + (inBeam ? IN_BEAM_WEIGHT : OUT_OF_BEAM_WEIGHT) * sideways
}

/** The index of the best candidate going `direction`, or -1. */
export function pickBest(from: Rect, candidates: Rect[], direction: Direction): number {
  let best = -1
  let bestScore = Infinity
  candidates.forEach((rect, index) => {
    const score = beamScore(from, rect, direction)
    if (score !== null && score < bestScore) {
      best = index
      bestScore = score
    }
  })
  return best
}

/** Key repeats (a held arrow) move at most this often. */
export const REPEAT_MS = 110

/**
 * How much a row must scroll (physical pixels, positive = towards the right) to show `item` with
 * `pad` to spare on each side. Physical rects make it right in RTL too: scrollBy is physical.
 */
export function rowDelta(row: { left: number; right: number }, item: { left: number; right: number }, pad: number): number {
  if (item.left < row.left + pad) return item.left - (row.left + pad)
  if (item.right > row.right - pad) return item.right - (row.right - pad)
  return 0
}

/** Where the TV can't go (phone things): clips, swipe, friends, movie nights. */
export const TV_UNAVAILABLE = ['/clips', '/swipe', '/friends', '/movie-night']

export const isTvUnavailable = (pathname: string) =>
  TV_UNAVAILABLE.some((path) => pathname === path || pathname.startsWith(`${path}/`))
