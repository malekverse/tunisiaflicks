// Checks the drama hubs against live TMDB data: the keyword ids each hub resolves, how many titles
// every shelf finds, and today's featured series (without the pick memory: no database here).
//
//   node --import ./tests/register.mjs scripts/check-drama-keywords.mjs [turkish|korean] [en|ar|tn]
//
// Needs TMDB_API_KEY (read from the environment, or from .env.local). Nothing is written anywhere.
import { readFileSync } from 'node:fs'

if (!process.env.TMDB_API_KEY) {
  try {
    const line = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).find((entry) => entry.startsWith('TMDB_API_KEY='))
    if (line) process.env.TMDB_API_KEY = line.slice('TMDB_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
  } catch {
    // No .env.local: the environment must carry the key.
  }
}
if (!process.env.TMDB_API_KEY) {
  console.error('TMDB_API_KEY is not set (environment or .env.local).')
  process.exit(1)
}
// The pick memory lives in MongoDB: leave it out, the script must not write.
delete process.env.MONGODB_URI

const { HUBS, HUB_IDS, ROW_SIZE, rowMinimum, isHubId } = await import('../src/lib/dramas-config.ts')
const { getFeatured, getShelf, resolveKeywords } = await import('../src/lib/dramas.ts')

const [hubArg, localeArg = 'en'] = process.argv.slice(2)
const hubs = hubArg ? (isHubId(hubArg) ? [hubArg] : null) : HUB_IDS
if (!hubs) {
  console.error(`Unknown hub "${hubArg}". Use one of: ${HUB_IDS.join(', ')}`)
  process.exit(1)
}
const quiet = console.error
console.error = () => {} // TMDB misses are reported as counts below.

const SHELVES = ['new-episodes', 'trending', 'favourites', 'romance', 'historical', 'thrillers', 'short', 'films']
const titleOf = (item) => item.name || item.title || ''

for (const hub of hubs) {
  const config = HUBS[hub]
  console.log(`\n${hub} (${config.language}/${config.country}, accent ${config.accent})`)

  for (const group of ['romance', 'historical']) {
    const words = config.keywords[group]
    const ids = await Promise.all(words.map((word) => resolveKeywords([word])))
    console.log(`  keywords ${group}:`)
    words.forEach((word, index) => console.log(`    ${word.padEnd(20)} ${ids[index].length ? ids[index].join(',') : '(none on TMDB)'}`))
  }

  console.log('  shelves (titles found / shown at least):')
  for (const shelf of SHELVES) {
    const started = Date.now()
    const items = await getShelf(hub, shelf, localeArg, ROW_SIZE)
    const enough = items.length >= rowMinimum(shelf) ? 'shown' : 'HIDDEN'
    const sample = items.slice(0, 3).map(titleOf).join(' | ')
    console.log(`    ${shelf.padEnd(13)} ${String(items.length).padStart(3)} / ${rowMinimum(shelf)}  ${enough.padEnd(6)} ${String(Date.now() - started).padStart(5)}ms  ${sample}`)
  }

  const featured = await getFeatured(hub, localeArg)
  console.log(featured
    ? `  featured today: ${featured.title} (tv/${featured.id}), ${featured.reason.type}: "${featured.why}" logo ${featured.logo ? 'yes' : 'no'}, trailer ${featured.trailer ?? 'none'}`
    : '  featured today: none (TMDB gave nothing)')
}

console.error = quiet
process.exit(0)
