import assert from 'node:assert/strict'
import test from 'node:test'
import { extractEmailDomain, normalizeSignupEmail, isValidEmailFormat, interpretSignupResult } from '../lib/auth/signup.ts'

test('normalizeSignupEmail trims and lowercases domain', () => {
  assert.equal(normalizeSignupEmail('  Student+Tag@Students.UTAH.EDU  '), 'Student+Tag@students.utah.edu')
})

test('extractEmailDomain supports school subdomains', () => {
  assert.equal(extractEmailDomain('User@students.school.edu'), 'students.school.edu')
})

test('email format validator handles plus addressing', () => {
  assert.equal(isValidEmailFormat('name+tag@school.edu'), true)
  assert.equal(isValidEmailFormat('name@@school.edu'), false)
})

test('interpretSignupResult maps duplicate user errors', () => {
  const result = interpretSignupResult({
    error: { message: 'User already registered', code: 'user_already_exists', status: 400 },
    userId: null,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.errorKey, 'USER_EXISTS')
    assert.equal(result.statusCode, 409)
  }
})

test('interpretSignupResult maps invalid email and network errors', () => {
  const invalid = interpretSignupResult({
    error: { message: 'Unable to validate email address: invalid format', code: 'validation_failed', status: 400 },
    userId: null,
  })
  assert.equal(invalid.ok, false)
  if (!invalid.ok) assert.equal(invalid.errorKey, 'INVALID_EMAIL')

  const network = interpretSignupResult({
    error: { message: 'fetch failed', name: 'AuthRetryableFetchError', status: 0 },
    userId: null,
  })
  assert.equal(network.ok, false)
  if (!network.ok) assert.equal(network.errorKey, 'NETWORK')
})

test('interpretSignupResult flags profile setup failure when auth returns no user', () => {
  const result = interpretSignupResult({
    error: null,
    userId: null,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.errorKey, 'PROFILE_SETUP')
    assert.equal(result.statusCode, 500)
  }
})
