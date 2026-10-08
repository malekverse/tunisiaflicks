#!/usr/bin/env node
// Client components must not pull every language into the browser bundle:
//   node scripts/check-client-i18n.mjs        (npm run check:i18n)
//
// Fails when a 'use client' file imports a value from '@/src/lib/i18n' itself (that module holds
// every dictionary). Client files import from '@/src/lib/i18n/locales', '/translate' or '/format'
// instead, and get `t` from useT(); `import type` from the index is fine (see docs/DESIGN.md).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

/**
 * Allowed for now, with the reason. The I18nProvider keeps the dictionaries as a fallback until the
 * root layout passes it `messages` (dictionaryFor); remove the entry with that import.
 */
const ALLOWED = new Map([
  ['src/components/I18nProvider.tsx', 'fallback translator until the root layout passes `messages`'],
])

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules' && !name.startsWith('.')) yield* files(full)
    } else if (/\.(tsx?|jsx?|mjs)$/.test(name)) {
      yield full
    }
  }
}

/** Whether the file starts with the 'use client' directive (comments and blank lines may come first). */
function isClient(source) {
  const code = source.replace(/^(?:\s+|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '')
  return /^(['"])use client\1/.test(code)
}

// import ... from '@/src/lib/i18n'  /  export ... from '@/src/lib/i18n'  (the index only, not /locales)
// The clause can't contain a quote, so a match never runs across an earlier statement.
const STATEMENT = /(?:^|\n)\s*(import|export)\s+([^'"`;]*?)\s+from\s+(['"])@\/src\/lib\/i18n(?:\/index)?\3/g

/** Whether an import/export clause brings in a value (not only types). */
function importsValue(kind, clause) {
  const text = clause.trim()
  if (text.startsWith('type ')) return false
  if (kind === 'export' && text === '*') return true
  const named = text.match(/\{([\s\S]*)\}/)
  const outside = named ? text.replace(named[0], '').replace(/,/g, '').trim() : text
  if (outside) return true // a default or namespace import
  return named[1].split(',').map((part) => part.trim()).filter(Boolean).some((part) => !part.startsWith('type '))
}

const problems = []
const allowedSeen = []
for (const file of files(SRC)) {
  const source = readFileSync(file, 'utf8')
  if (!isClient(source)) continue
  const relative = path.relative(ROOT, file).split(path.sep).join('/')
  for (const match of source.matchAll(STATEMENT)) {
    if (!importsValue(match[1], match[2])) continue
    const line = source.slice(0, match.index + (match[0].startsWith('\n') ? 1 : 0)).split('\n').length
    if (ALLOWED.has(relative)) allowedSeen.push(`${relative}:${line} (${ALLOWED.get(relative)})`)
    else problems.push(`${relative}:${line}: ${match[0].trim().replace(/\s+/g, ' ')}`)
  }
}

for (const entry of allowedSeen) console.log(`allowed: ${entry}`)
if (problems.length) {
  console.error(`\n${problems.length} client file${problems.length === 1 ? ' imports' : 's import'} a value from '@/src/lib/i18n' (every dictionary).`)
  console.error("Import from '@/src/lib/i18n/locales', '@/src/lib/i18n/translate' or '@/src/lib/i18n/format' instead, or use `import type`:")
  for (const problem of problems) console.error(`  ${problem}`)
  process.exitCode = 1
} else {
  console.log('check-client-i18n: no client file imports the dictionaries.')
}
