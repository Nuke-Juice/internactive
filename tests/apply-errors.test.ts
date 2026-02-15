import assert from 'node:assert/strict'
import test from 'node:test'
import { APPLY_ERROR, isCapReachedApplicationError } from '../lib/applyErrors.ts'

test('apply error constants include CAP_REACHED', () => {
  assert.equal(APPLY_ERROR.CAP_REACHED, 'CAP_REACHED')
})

test('detects cap reached from rpc error message', () => {
  assert.equal(isCapReachedApplicationError({ message: 'cap_reached' }), true)
  assert.equal(isCapReachedApplicationError({ message: 'Application failed: CAP_REACHED' }), true)
})

test('ignores non-cap errors', () => {
  assert.equal(isCapReachedApplicationError({ message: 'duplicate key value' }), false)
  assert.equal(isCapReachedApplicationError(null), false)
})
