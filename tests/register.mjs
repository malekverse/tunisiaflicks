// Lets `node --test` import the app's TypeScript modules directly:
//   node --import ./tests/register.mjs --test "tests/*.unit.test.*"
// Node 22 strips the types itself; the hooks in ./loader-hooks.mjs add what Next.js normally
// provides (the '@/' alias, extensionless imports, and stand-ins for next/cache, next/headers and
// server-only). See that file for the details.
import { register } from 'node:module'

register('./loader-hooks.mjs', import.meta.url)
