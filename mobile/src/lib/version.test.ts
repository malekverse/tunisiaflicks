import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newer } from './version.ts'

test('newer compares versions part by part', () => {
  assert.equal(newer('2.1.0', '2.0.3'), true)
  assert.equal(newer('2.0.10', '2.0.9'), true)
  assert.equal(newer('2.0', '2.0.0'), false)
  assert.equal(newer('1.9.9', '2.0.0'), false)
})
