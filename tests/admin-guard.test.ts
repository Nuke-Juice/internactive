import assert from 'node:assert/strict'
import test from 'node:test'
import { decideAdminAccess } from '../lib/auth/adminGuard.ts'
import { isAdminRole } from '../lib/auth/roles.ts'

test('allows super_admin access to /admin routes', () => {
  assert.deepEqual(decideAdminAccess('super_admin'), { allowed: true })
})

test('allows ops_admin access to /admin routes', () => {
  assert.deepEqual(decideAdminAccess('ops_admin'), { allowed: true })
})

test('rejects support access to /admin routes', () => {
  assert.deepEqual(decideAdminAccess('support'), { allowed: false, reason: 'forbidden' })
})

test('rejects employer access to /admin routes', () => {
  assert.deepEqual(decideAdminAccess('employer'), { allowed: false, reason: 'forbidden' })
})

test('rejects student access to /admin routes', () => {
  assert.deepEqual(decideAdminAccess('student'), { allowed: false, reason: 'forbidden' })
})

test('rejects missing role for /admin routes', () => {
  assert.deepEqual(decideAdminAccess(undefined), { allowed: false, reason: 'unauthenticated' })
})

test('isAdminRole returns true only for ops_admin and super_admin', () => {
  assert.equal(isAdminRole('ops_admin'), true)
  assert.equal(isAdminRole('super_admin'), true)
  assert.equal(isAdminRole('support'), false)
  assert.equal(isAdminRole('employer'), false)
  assert.equal(isAdminRole('student'), false)
  assert.equal(isAdminRole('admin'), false)
})
