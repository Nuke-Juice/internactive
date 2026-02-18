import assert from 'node:assert/strict'
import test from 'node:test'
import { isResumeStoragePathOwnedByUser } from '../lib/student/resumeStorageOwnership.ts'

test('accepts a resume storage path owned by the authenticated user', () => {
  const userId = '11111111-1111-1111-1111-111111111111'
  const path = `resumes/${userId}/listing-a/resume.pdf`
  assert.equal(isResumeStoragePathOwnedByUser(userId, path), true)
})

test('rejects resume storage path tampering to another user namespace', () => {
  const attackerId = '11111111-1111-1111-1111-111111111111'
  const victimId = '22222222-2222-2222-2222-222222222222'
  const tamperedPath = `resumes/${victimId}/listing-a/resume.pdf`
  assert.equal(isResumeStoragePathOwnedByUser(attackerId, tamperedPath), false)
})

test('rejects leading slash path tampering to another user namespace', () => {
  const attackerId = '11111111-1111-1111-1111-111111111111'
  const victimId = '22222222-2222-2222-2222-222222222222'
  const tamperedPath = `/resumes/${victimId}/listing-a/resume.pdf`
  assert.equal(isResumeStoragePathOwnedByUser(attackerId, tamperedPath), false)
})
