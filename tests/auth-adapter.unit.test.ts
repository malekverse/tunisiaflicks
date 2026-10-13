// Unit tests for the NextAuth adapter wrapper (src/lib/auth-adapter): made on first use, never at
// startup, and made again after a failure. No database:
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Adapter } from 'next-auth/adapters'
import { lazyAdapter } from '@/src/lib/auth-adapter'

/** A stand-in adapter whose getUserByEmail fails while `down` is true. */
function fakeMaker(state: { down: boolean }) {
  let made = 0
  const make = () => {
    made++
    const id = made
    return {
      getUserByEmail: async (email: string) => {
        if (state.down) throw new Error('database unreachable')
        return { id: `user-${id}`, email, emailVerified: null }
      },
    } as unknown as Adapter
  }
  return { make, made: () => made }
}

test('lazyAdapter: nothing is made (no database read) until a method is called', async () => {
  const maker = fakeMaker({ down: false })
  const adapter = lazyAdapter(maker.make)
  assert.equal(maker.made(), 0)
  // Every method NextAuth may call is there.
  assert.equal(Object.keys(adapter).length, 14)
  for (const name of ['getUserByEmail', 'createUser', 'linkAccount', 'useVerificationToken']) assert.equal(typeof (adapter as Record<string, unknown>)[name], 'function', name)
  assert.equal((await adapter.getUserByEmail!('a@example.test'))?.id, 'user-1')
  assert.equal((await adapter.getUserByEmail!('b@example.test'))?.id, 'user-1') // the same one, kept
  assert.equal(maker.made(), 1)
})

test('lazyAdapter: a failed call drops the adapter, the next call makes a new one', async () => {
  const state = { down: true }
  const maker = fakeMaker(state)
  const adapter = lazyAdapter(maker.make)
  await assert.rejects(async () => adapter.getUserByEmail!('a@example.test'), /unreachable/)
  state.down = false
  // Not stuck on the broken one: a fresh adapter (and so a fresh connection).
  assert.equal((await adapter.getUserByEmail!('a@example.test'))?.id, 'user-2')
  assert.equal(maker.made(), 2)
})
