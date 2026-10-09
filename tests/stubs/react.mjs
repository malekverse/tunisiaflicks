// Stand-in for 'react' in unit tests: React itself, plus `cache` (only React's server build has it;
// in a test, a cached function is simply called every time).
import { createRequire } from 'node:module'

const React = createRequire(import.meta.url)('react')

export const cache = React.cache ?? ((fn) => fn)
export default React
