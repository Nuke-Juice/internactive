import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canUseClaimToken,
  claimTokenExpiresAt,
  getClaimTokenStatus,
  hashEmployerClaimToken,
} from '../lib/auth/employerClaimToken.ts'

test('token is expired after expiry timestamp', () => {
  const now = new Date('2026-02-09T12:00:00.000Z')
  const record = {
    used_at: null,
    expires_at: '2026-02-09T11:59:59.000Z',
  }

  assert.equal(getClaimTokenStatus(record, now), 'expired')
  assert.equal(canUseClaimToken(record, now), false)
})

test('token is single-use once marked used', () => {
  const now = new Date('2026-02-09T12:00:00.000Z')
  const expiresAt = claimTokenExpiresAt(now)

  const unusedRecord = {
    used_at: null,
    expires_at: expiresAt,
  }

  assert.equal(getClaimTokenStatus(unusedRecord, now), 'valid')
  assert.equal(canUseClaimToken(unusedRecord, now), true)

  const usedRecord = {
    ...unusedRecord,
    used_at: '2026-02-09T12:00:01.000Z',
  }

  assert.equal(getClaimTokenStatus(usedRecord, now), 'used')
  assert.equal(canUseClaimToken(usedRecord, now), false)
})

test('token hashing is deterministic and non-plain-text', () => {
  const raw = 'sample-claim-token'
  const hashA = hashEmployerClaimToken(raw)
  const hashB = hashEmployerClaimToken(raw)

  assert.equal(hashA, hashB)
  assert.notEqual(hashA, raw)
  assert.equal(hashA.length, 64)
})
