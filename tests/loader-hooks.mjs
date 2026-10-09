// Module resolution for unit tests (registered by ./register.mjs), so a test can import
// '@/src/lib/...' the way the app does, without a bundler:
// - '@/x' is the repository root (tsconfig "paths").
// - Extensionless or directory specifiers try .ts, .mts, .mjs and .js, then /index.ts.
// - 'next/cache', 'next/headers', 'server-only' and 'react' (for `cache`) resolve to small stand-ins
//   in ./stubs, and so does '@/src/lib/auth' (no sign-in in a unit test).
// - 'next/server' resolves to Next's own file (the package has no exports map for ESM).
// - .tsx is not supported (Node can strip types but has no JSX transform): keep testable logic in
//   .ts files.
import { statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TESTS = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(TESTS, '..')
const EXTENSIONS = ['.ts', '.mts', '.mjs', '.js']

const STUBS = {
  'next/cache': 'next-cache.mjs',
  'next/headers': 'next-headers.mjs',
  'server-only': 'empty.mjs',
  react: 'react.mjs',
  '@/src/lib/auth': 'auth.mjs',
}

const isFile = (file) => {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

/** The file a path points to: as written, with one of EXTENSIONS, or the directory's index.ts. */
function probe(file) {
  if (isFile(file)) return file
  for (const extension of EXTENSIONS) if (isFile(file + extension)) return file + extension
  const index = path.join(file, 'index.ts')
  return isFile(index) ? index : null
}

export async function resolve(specifier, context, nextResolve) {
  const stub = STUBS[specifier]
  if (stub) return { url: pathToFileURL(path.join(TESTS, 'stubs', stub)).href, shortCircuit: true }
  if (specifier === 'next/server') return nextResolve('next/server.js', context)

  let candidate = null
  if (specifier.startsWith('@/')) {
    candidate = path.join(ROOT, specifier.slice(2))
  } else if (/^\.{1,2}\//.test(specifier) && context.parentURL?.startsWith('file:')) {
    candidate = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
  }
  if (!candidate) return nextResolve(specifier, context)

  const found = candidate.endsWith('.tsx') ? null : probe(candidate)
  if (!found) {
    if (candidate.endsWith('.tsx') || isFile(candidate + '.tsx')) {
      throw new Error(`Unit tests can't import .tsx files (no JSX transform): ${specifier}`)
    }
    return nextResolve(specifier, context)
  }
  return { url: pathToFileURL(found).href, shortCircuit: true }
}
