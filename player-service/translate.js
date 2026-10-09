// Subtitle translation: a batch of subtitle lines into another language, through Google Translate's
// free web endpoint (the one browser extensions use). It needs no
// key, but it's unofficial and may slow down or refuse a heavy user; the player shows the original
// subtitles again if it does. Lines go one per line of text, so the translation splits back cue by cue.

import https from 'node:https'

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single'

/** The languages the player offers to translate into (ISO 639-1, as Google takes them). */
export const TARGETS = {
  ar: 'Arabic', fr: 'French', en: 'English', es: 'Spanish', de: 'German', it: 'Italian',
  tr: 'Turkish', pt: 'Portuguese', nl: 'Dutch', ru: 'Russian',
}

export const MAX_LINES = 120
export const MAX_CHARS = 5000

const cache = new Map()   // `${to}\n${text}` -> translated lines (the newest 200 batches)

/** POST through node:https: the endpoint turns Node's own fetch away (429), but not a plain request. */
function post(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('timeout', () => req.destroy(new Error('The translator didn’t answer')))
    req.on('error', reject)
    req.end(body)
  })
}

async function translateText(text, to) {
  const res = await post(`${ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t`, new URLSearchParams({ q: text }).toString())
  if (res.status !== 200) throw new Error(res.status === 429 ? 'The translator is busy. Try again in a minute.' : `Translator answered ${res.status}`)
  const json = JSON.parse(res.text)
  if (!Array.isArray(json?.[0])) throw new Error('The translator gave nothing back')
  return json[0].map((part) => (Array.isArray(part) && typeof part[0] === 'string' ? part[0] : '')).join('')
}

/**
 * Translate lines (one subtitle cue each) into `to`. A batch whose translation doesn't come back
 * with as many lines is split in two and tried again, down to single lines.
 */
export async function translateLines(lines, to) {
  const clean = lines.map((line) => String(line).replace(/\s*\n\s*/g, ' ').trim())
  const key = `${to}\n${clean.join('\n')}`
  if (cache.has(key)) return cache.get(key)

  let out
  const text = await translateText(clean.join('\n'), to)
  const back = text.split('\n').map((l) => l.trim())
  if (back.length === clean.length) out = back
  else if (clean.length === 1) out = [back.join(' ')]
  else {
    const half = Math.ceil(clean.length / 2)
    out = [...await translateLines(clean.slice(0, half), to), ...await translateLines(clean.slice(half), to)]
  }

  cache.set(key, out)
  if (cache.size > 200) cache.delete(cache.keys().next().value)
  return out
}
