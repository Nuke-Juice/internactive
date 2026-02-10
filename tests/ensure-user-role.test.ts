import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRoleDecision } from '../lib/auth/roleDecision.ts'

test('ops_admin is sticky and cannot be downgraded by chooser submission', () => {
  const decision = resolveRoleDecision({
    currentRole: 'ops_admin',
    desiredRole: 'student',
    rowExists: true,
    explicitSwitch: true,
  })

  assert.deepEqual(decision, {
    finalRole: 'ops_admin',
    actionTaken: 'blocked_admin_override',
    shouldWrite: false,
  })
})

test('student can explicitly switch to employer on chooser submit', () => {
  const decision = resolveRoleDecision({
    currentRole: 'student',
    desiredRole: 'employer',
    rowExists: true,
    explicitSwitch: true,
  })

  assert.deepEqual(decision, {
    finalRole: 'employer',
    actionTaken: 'updated',
    shouldWrite: true,
  })
})

test('missing users row results in created role row with desired role', () => {
  const decision = resolveRoleDecision({
    currentRole: null,
    desiredRole: 'student',
    rowExists: false,
    explicitSwitch: true,
  })

  assert.deepEqual(decision, {
    finalRole: 'student',
    actionTaken: 'created',
    shouldWrite: true,
  })
})

test('regression: admin role cannot be downgraded (no upsert-like overwrite)', () => {
  const decision = resolveRoleDecision({
    currentRole: 'super_admin',
    desiredRole: 'employer',
    rowExists: true,
    explicitSwitch: true,
  })

  assert.deepEqual(decision, {
    finalRole: 'super_admin',
    actionTaken: 'blocked_admin_override',
    shouldWrite: false,
  })
})
