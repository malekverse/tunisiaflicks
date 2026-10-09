#!/usr/bin/env node
// Which UI strings each page sends to the browser:
//   node scripts/client-i18n-keys.mjs            (npm run i18n:keys) writes src/lib/i18n/client-keys.ts
//   node scripts/client-i18n-keys.mjs --check    (npm run check:i18n) fails when it is out of date
//
// Client components translate with the strings the server hands the I18nProvider, and those travel
// in every page's HTML. So each page gets only what it may need:
// - the shell, on every page (the root layout sends it): what the client components of the root
//   layout, template, error, loading and not-found translate, what API routes, server actions and
//   the middleware hand on, what the client components of many pages translate, and what a page
//   that no scope covers needs;
// - a scope: what the client components under a `<ClientMessages scope="…">` translate, beyond the
//   shell. The scope is named after its file ('movie-night/layout', 'page'): in a layout it covers
//   the whole segment (every page, loading, error and not-found under it), anywhere else that file;
// - server-only: everything else, never sent.
//
// A client module (a 'use client' file, or anything one imports, followed through '@/…' and
// relative imports; `import type` doesn't count) may translate every key it writes: a quoted string
// that looks like a key counts as the key and as a prefix ('dramas.episodes' brings
// 'dramas.episodes.one', … for pluralKey), a template literal that starts with a namespace as a
// pattern (`badges.tier.${tier}` brings every badges.tier.*). A server module hands on the keys it
// writes anywhere but as the first argument of t(…) or richT(t, …): a prop, an API response, an
// inbox item stored in the database. Those go with the page that runs the module, or to the shell.
//
// The file lists the scoped and the server-only keys; the shell is the rest, so a key added since
// the file was written goes to every page (a few bytes too many, never a string missing). What
// can go wrong is using a scoped or server-only key in another client component without running
// this script: the I18nProvider warns about it in development, and CI runs --check.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The dictionaries are TypeScript: load them with the unit tests' resolver ('@/', .ts). Node's
// notice about reparsing them as ES modules is noise here.
process.removeAllListeners('warning')
register('../tests/loader-hooks.mjs', import.meta.url)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const APP = path.join(SRC, 'app')
const I18N = path.join(SRC, 'lib', 'i18n')
const OUTPUT = path.join(I18N, 'client-keys.ts')
const CHECK = process.argv.includes('--check')
/** A key that the client components of this many entries (pages, loading, error…) translate is in the shell. */
const SHARED_BY = 6

// Every key: English is complete.
const { en } = await import('@/src/lib/i18n/en')
const { featureStrings } = await import('@/src/lib/i18n/features')
const KEYS = [...new Set([...Object.keys(en), ...Object.keys(featureStrings('en'))])].sort()

const posix = (file) => path.relative(ROOT, file).split(path.sep).join('/')

// --- The modules ---

// The dictionaries, and this script's own output, say nothing about who translates a key.
const SKIPPED = new Set(['en.ts', 'ar.ts', 'fr.ts', 'tn.ts', 'client-keys.ts'].map((name) => path.join(I18N, name)))
const skipped = (file) => SKIPPED.has(file) || path.dirname(file) === path.join(I18N, 'features')

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules' && !name.startsWith('.')) yield* files(full)
    } else if (/\.(tsx?|jsx?|mjs)$/.test(name) && !name.endsWith('.d.ts')) {
      yield full
    }
  }
}

const sources = new Map()
for (const file of files(SRC)) if (!skipped(file)) sources.set(file, readFileSync(file, 'utf8'))

/** 'client' or 'server' when the file starts with 'use client' or 'use server' (comments and blank lines may come first). */
function directive(source) {
  const code = source.replace(/^(?:\s+|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '')
  return code.match(/^(['"])use (client|server)\1/)?.[2] ?? null
}

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js']

function resolve(from, specifier) {
  let base
  if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier)
  else return null // a package
  for (const extension of EXTENSIONS) {
    if (sources.has(base + extension)) return base + extension
  }
  return null
}

// import x from '…' / import { a, type B } from '…' / export … from '…' / import '…' / import('…')
const IMPORT = /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^'"`;]*?\s+from\s+)?(['"])([^'"\n]+)\2|\bimport\(\s*(['"])([^'"\n]+)\4\s*\)/g

const importCache = new Map()
function imports(file) {
  let out = importCache.get(file)
  if (!out) {
    out = []
    for (const match of sources.get(file).matchAll(IMPORT)) {
      if (match[1]) continue // import type / export type
      const target = resolve(file, match[3] ?? match[5])
      if (target) out.push(target)
    }
    importCache.set(file, out)
  }
  return out
}

/**
 * The modules `roots` run, on the server and in the browser: a 'use client' file, and everything it
 * imports, is a client module; the rest are server modules (a file can be both).
 */
function modules(roots) {
  const client = new Set()
  const server = new Set()
  const queue = roots.map((file) => [file, false])
  while (queue.length) {
    const [file, parentClient] = queue.pop()
    const inClient = parentClient || directive(sources.get(file)) === 'client'
    const seen = inClient ? client : server
    if (seen.has(file)) continue
    seen.add(file)
    for (const target of imports(file)) queue.push([target, inClient])
  }
  return { client, server }
}

// --- The keys a module writes ---

const NAME = String.raw`[A-Za-z][\w-]*`
// 'nav.home', "dramas.episodes", `more.error`
const LITERAL = new RegExp(String.raw`(['"\`])(${NAME}(?:\.[\w-]+)+)\1`, 'g')
// `badges.tier.${tier}`, `dramas.${hub}.title`: a namespace, then at least one ${…}.
const TEMPLATE = new RegExp(String.raw`\`(${NAME}\.(?:[\w.-]|\$\{[^}\`]*\})*\$\{[^}\`]*\}(?:[\w.-]|\$\{[^}\`]*\})*)\``, 'g')
// What the server translates itself: t('…'), t(`…`), t(k(`…`)), x.t('…'), richT(t, '…').
const SERVER_CALL = new RegExp(String.raw`(?:\bt\(\s*(?:k\(\s*)?|\brichT\(\s*\w+\s*,\s*)(['"\`])${NAME}\.[^'"\`\n]*\1`, 'g')

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The keys `text` writes. `strict`: only templates whose ${…} are names (`badges.${card.id}`), not
 * expressions (`profiles.${MAX_PROFILES - 1}` is a database path): in server modules a template is
 * often something else than a key.
 */
function keysIn(text, strict) {
  const exact = new Set()
  const patterns = []
  for (const match of text.matchAll(LITERAL)) exact.add(match[2])
  for (const match of text.matchAll(TEMPLATE)) {
    const parts = match[1].split(/\$\{([^}]*)\}/) // text, expression, text, …
    if (strict && parts.some((part, index) => index % 2 === 1 && !/^[\w.?]+$/.test(part.trim()))) continue
    patterns.push(new RegExp(`^${parts.filter((part, index) => index % 2 === 0).map(escape).join('.+')}$`))
  }
  if (!exact.size && !patterns.length) return []
  return KEYS.filter((key) => {
    if (exact.has(key)) return true
    for (let end = key.lastIndexOf('.'); end > 0; end = key.lastIndexOf('.', end - 1)) {
      if (exact.has(key.slice(0, end))) return true
    }
    return patterns.some((pattern) => pattern.test(key))
  })
}

const keyCache = new Map()
/** As a client module, every key the file writes; as a server module, the ones it hands on. */
function keysOf(file, client) {
  const id = `${client ? 'client' : 'server'}:${file}`
  if (!keyCache.has(id)) {
    const source = sources.get(file)
    keyCache.set(id, client ? keysIn(source, false) : keysIn(source.replace(SERVER_CALL, ''), true))
  }
  return keyCache.get(id)
}

/** What the client components rendered from `roots` may translate. */
function keysFor(roots) {
  const { client, server } = modules(roots)
  const keys = new Set()
  for (const file of client) for (const key of keysOf(file, true)) keys.add(key)
  for (const file of server) for (const key of keysOf(file, false)) keys.add(key)
  return keys
}

// --- Shell, scopes, server-only ---

const ENTRY = /^(page|layout|template|loading|error|not-found|default|global-error)\.(tsx?|jsx?)$/
const inApp = (file) => file.startsWith(APP + path.sep)
const entries = [...sources.keys()].filter((file) => inApp(file) && ENTRY.test(path.basename(file)))
const shellEntries = entries.filter((file) => path.dirname(file) === APP && !/^page\./.test(path.basename(file)))
// What answers the browser outside a page: API routes, server actions, the middleware. A key they
// hand on may be shown on any page.
const handlers = [...sources.keys()].filter((file) => (inApp(file) && /^route\./.test(path.basename(file)))
  || /^(middleware|instrumentation)\./.test(path.relative(SRC, file))
  || directive(sources.get(file)) === 'server')

const shell = keysFor([...shellEntries, ...handlers])
// What the client components of many pages translate (rows, pagination, 'Loading…') goes to the
// shell too: cheaper than a scope on each of them.
const pageCount = new Map()
for (const entry of entries) {
  if (shellEntries.includes(entry)) continue
  for (const key of keysFor([entry])) pageCount.set(key, (pageCount.get(key) ?? 0) + 1)
}
for (const [key, count] of pageCount) if (count >= SHARED_BY) shell.add(key)

const problems = []
const SCOPE_USE = /<ClientMessages\s+scope=(['"])([^'"]+)\1/g
const scopes = []
for (const [file, source] of sources) {
  if (!inApp(file)) continue
  for (const match of source.matchAll(SCOPE_USE)) {
    const name = path.relative(APP, file).split(path.sep).join('/').replace(/\.[jt]sx?$/, '')
    if (match[2] !== name) problems.push(`${posix(file)}: <ClientMessages scope="${match[2]}"> must be named after its file: scope="${name}".`)
    if (scopes.some((scope) => scope.file === file)) continue // the same scope twice (two returns)
    // In a layout, the whole segment; anywhere else, that file.
    const dir = /^layout\./.test(path.basename(file)) ? path.dirname(file) : null
    scopes.push({ name, file, covers: (entry) => entry === file || (dir !== null && entry.startsWith(dir + path.sep)) })
  }
}
for (const scope of scopes) {
  const inner = scopes.find((other) => other !== scope && scope.covers(other.file))
  if (inner) problems.push(`${posix(inner.file)}: <ClientMessages scope="${inner.name}"> is inside scope "${scope.name}", which already covers it. Keep one.`)
}
scopes.sort((a, b) => (a.name < b.name ? -1 : 1))

// A page (loading, error…) that no scope covers gets its strings from the shell: correct, but on
// every page. Worth a scope once that's more than a few keys.
const unscoped = []
for (const entry of entries) {
  if (shellEntries.includes(entry) || scopes.some((scope) => scope.covers(entry))) continue
  const added = [...keysFor([entry])].filter((key) => !shell.has(key))
  for (const key of added) shell.add(key)
  if (added.length) unscoped.push(`${posix(entry)} (${added.length})`)
}
for (const scope of scopes) scope.keys = [...keysFor(entries.filter(scope.covers))].filter((key) => !shell.has(key)).sort()

if (problems.length) {
  console.error(`client-i18n-keys: ${problems.length} problem${problems.length === 1 ? '' : 's'}:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

const scoped = new Set(scopes.flatMap((scope) => scope.keys))
const serverOnly = KEYS.filter((key) => !shell.has(key) && !scoped.has(key))
const list = (keys, indent) => keys.map((key) => `${indent}'${key}',`).join('\n')
const summary = `${shell.size} of ${KEYS.length} keys on every page, ${scoped.size} in ${scopes.length} scopes, ${serverOnly.length} server-only`

const output = `// Written by scripts/client-i18n-keys.mjs (npm run i18n:keys): don't edit by hand.
//
// Which strings go to the browser (see clientMessages in ./index.ts): the root layout sends every
// key that is in neither list below (the shell), a <ClientMessages scope> adds its scope's keys to
// the pages under it, and the server-only keys never leave the server.
// ${summary}.

export type MessageScope =
${scopes.map((scope) => `  | '${scope.name}'`).join('\n') || '  never'}

/** Keys no client component translates. */
export const SERVER_ONLY_KEYS: readonly string[] = [
${list(serverOnly, '  ')}
]

/** Keys that only the client components under a scope translate (beyond the shell). */
export const SCOPE_KEYS: Record<MessageScope, readonly string[]> = {
${scopes.map((scope) => `  '${scope.name}': [\n${list(scope.keys, '    ')}\n  ],`).join('\n')}
}
`

let current = ''
try {
  current = readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n')
} catch {
  // Not written yet.
}

if (CHECK) {
  if (current !== output) {
    console.error('client-i18n-keys: src/lib/i18n/client-keys.ts is out of date. Run `npm run i18n:keys` and commit it.')
    process.exitCode = 1
  } else {
    console.log(`client-i18n-keys: up to date (${summary}).`)
  }
} else {
  if (current !== output) writeFileSync(OUTPUT, output)
  console.log(`client-i18n-keys: ${summary}.`)
  if (unscoped.length) console.log(`Pages without a scope, and the keys they add to the shell: ${unscoped.join(', ')}.`)
}
