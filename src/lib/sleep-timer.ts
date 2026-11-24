// The player's sleep timer: stop after N minutes, or at the end of this episode (or film). In the
// last minute the picture dims and a note offers more time; then the player stops (the frame is
// taken away, so every source stops, and the screen may sleep). It survives the next episode
// opening, but "end of this episode" ends when the episode changes. Pure, so it's unit-tested;
// hooks/use-sleep-timer keeps the state.

export const SLEEP_MINUTES = [15, 30, 45, 60, 90] as const
/** The dimming and the note start this long before the end. */
export const WARN_MS = 60_000
/** "A bit more" adds this much. */
export const EXTEND_MS = 15 * 60_000
/** An episode's end, from its running time: a little past it, for the credits and a slow start. */
export const EPISODE_MARGIN_MS = 3 * 60_000

export type SleepTimer =
  | { kind: 'minutes', endsAt: number }
  /** Ends at `endsAt` or when the playing title stops being `media`, whichever comes first. */
  | { kind: 'episode', endsAt: number, media: string }

export function minutesTimer(minutes: number, now: number): SleepTimer {
  return { kind: 'minutes', endsAt: now + Math.max(1, minutes) * 60_000 }
}

/** Null when the running time isn't known (the option isn't offered then). */
export function episodeTimer(runtimeMinutes: number | null | undefined, media: string, now: number): SleepTimer | null {
  if (!runtimeMinutes || !Number.isFinite(runtimeMinutes) || runtimeMinutes <= 0 || !media) return null
  return { kind: 'episode', endsAt: now + runtimeMinutes * 60_000 + EPISODE_MARGIN_MS, media }
}

export const extend = (timer: SleepTimer, now: number): SleepTimer =>
  ({ ...timer, endsAt: Math.max(timer.endsAt, now) + EXTEND_MS })

/** Has the timer run out (time's up, or the episode it was for is over)? */
export function isDue(timer: SleepTimer, now: number, media: string | null): boolean {
  if (now >= timer.endsAt) return true
  return timer.kind === 'episode' && media !== null && media !== timer.media
}

/** How dark the picture is in the last minute: 0 before it, up to 0.7 at the end. */
export function dimFor(remaining: number): number {
  if (remaining >= WARN_MS) return 0
  return Math.round((1 - Math.max(0, remaining) / WARN_MS) * 0.7 * 100) / 100
}

/** "1:05:09", "23:10", "0:42". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** A timer read back from storage, checked (null when it's not one, or already over). */
export function readTimer(raw: unknown, now: number): SleepTimer | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const endsAt = Number(value.endsAt)
  if (!Number.isFinite(endsAt) || endsAt <= now || endsAt > now + 6 * 3600_000) return null
  if (value.kind === 'minutes') return { kind: 'minutes', endsAt }
  if (value.kind === 'episode' && typeof value.media === 'string' && value.media.length <= 80) return { kind: 'episode', endsAt, media: value.media }
  return null
}
