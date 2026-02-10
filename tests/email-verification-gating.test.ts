import assert from 'node:assert/strict'
import test from 'node:test'
import { requireVerifiedEmail, resendVerificationEmail } from '../lib/auth/emailVerification.ts'

test('unverified student cannot submit application', () => {
  const result = requireVerifiedEmail({
    user: {
      id: 'student-1',
      email: 'student@example.com',
      email_confirmed_at: null,
    },
    nextUrl: '/apply/listing-123',
    actionName: 'application_submit',
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'EMAIL_NOT_VERIFIED')
    assert.ok(result.redirectTo.startsWith('/verify-required?'))
  }
})

test('unverified employer cannot publish internship', () => {
  const result = requireVerifiedEmail({
    user: {
      id: 'employer-1',
      email: 'employer@example.com',
      email_confirmed_at: null,
    },
    nextUrl: '/dashboard/employer',
    actionName: 'internship_publish',
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, 'EMAIL_NOT_VERIFIED')
    assert.ok(result.redirectTo.includes('internship_publish'))
  }
})

test('verified users can proceed', () => {
  const appResult = requireVerifiedEmail({
    user: {
      id: 'student-1',
      email: 'student@example.com',
      email_confirmed_at: '2026-02-09T00:00:00.000Z',
    },
    nextUrl: '/apply/listing-123',
    actionName: 'application_submit',
  })
  const publishResult = requireVerifiedEmail({
    user: {
      id: 'employer-1',
      email: 'employer@example.com',
      email_confirmed_at: '2026-02-09T00:00:00.000Z',
    },
    nextUrl: '/dashboard/employer',
    actionName: 'internship_publish',
  })

  assert.equal(appResult.ok, true)
  assert.equal(publishResult.ok, true)
})

test('resend verification handles provider errors', async () => {
  const result = await resendVerificationEmail({
    email: 'user@example.com',
    emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2F',
    resend: async () => ({ error: { message: 'Rate limit' } }),
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error, 'Rate limit')
  }
})
