import assert from 'node:assert/strict'
import test from 'node:test'
import { canCreateCanonicalItems } from '../lib/catalog/canCreateCanonicalItems.ts'

test('only admins can create canonical catalog items', () => {
  assert.equal(canCreateCanonicalItems('ops_admin'), true)
  assert.equal(canCreateCanonicalItems('super_admin'), true)
  assert.equal(canCreateCanonicalItems('support'), false)
  assert.equal(canCreateCanonicalItems('student'), false)
  assert.equal(canCreateCanonicalItems('employer'), false)
  assert.equal(canCreateCanonicalItems(undefined), false)
})
