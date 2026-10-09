// What the player remembers between films and between runs: the viewer's preferences (volume,
// speed, subtitle language and style) and where they stopped in each title. Kept in DATA_DIR,
// not in the page's storage: the desktop app serves the player on a new port each time it starts,
// and a page's storage goes with its origin.

import fs from 'node:fs'
import path from 'node:path'

const MAX_TITLES = 500
const PREF_KEYS = {
  volume: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  muted: (v) => typeof v === 'boolean',
  speed: (v) => typeof v === 'number' && v >= 0.25 && v <= 4,
  subLang: (v) => v === null || (typeof v === 'string' && v.length <= 12),
  subSize: (v) => ['s', 'm', 'l', 'xl'].includes(v),
  subStyle: (v) => ['shadow', 'box'].includes(v),
  subTranslate: (v) => v === null || (typeof v === 'string' && /^[a-z]{2}$/.test(v)),
  audioLang: (v) => v === null || (typeof v === 'string' && /^[a-z]{2,3}$/.test(v)),
}

/** 'movie:550' or 'tv:1399:1:2'. */
export const isTitleKey = (key) => /^(movie:\d{1,9}|tv:\d{1,9}:\d{1,3}:\d{1,4})$/.test(String(key))

/** Only the known preferences, with valid values. */
export function cleanPrefs(input) {
  const out = {}
  if (!input || typeof input !== 'object') return out
  for (const [key, valid] of Object.entries(PREF_KEYS)) if (key in input && valid(input[key])) out[key] = input[key]
  return out
}

export function createStateStore(dataDir) {
  const file = path.join(dataDir, 'player-state.json')
  let state = null
  let timer = null

  const load = () => {
    if (state) return state
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
      state = { prefs: cleanPrefs(saved.prefs), progress: saved.progress && typeof saved.progress === 'object' ? saved.progress : {} }
    } catch {
      state = { prefs: {}, progress: {} }
    }
    return state
  }

  // Written a moment after the last change, not on every progress tick.
  const save = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        fs.mkdirSync(dataDir, { recursive: true })
        fs.writeFileSync(file, JSON.stringify(state))
      } catch (err) {
        console.error('[state] could not save', err.message)
      }
    }, 1500)
    timer.unref?.()
  }

  return {
    prefs: () => load().prefs,
    setPrefs(input) {
      const s = load()
      s.prefs = { ...s.prefs, ...cleanPrefs(input) }
      save()
      return s.prefs
    },
    progress: (key) => load().progress[key] ?? null,
    /** Where the viewer is in a title ({ t, d } in seconds); near the end, it's forgotten. */
    setProgress(key, t, d) {
      const s = load()
      if (!(t >= 0) || !(d > 0) || t > d * 0.95) delete s.progress[key]
      else s.progress[key] = { t: Math.round(t), d: Math.round(d), at: Date.now() }
      const keys = Object.keys(s.progress)
      if (keys.length > MAX_TITLES) {
        keys.sort((a, b) => s.progress[a].at - s.progress[b].at)
        for (const old of keys.slice(0, keys.length - MAX_TITLES)) delete s.progress[old]
      }
      save()
    },
  }
}
