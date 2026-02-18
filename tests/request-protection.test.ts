import assert from 'node:assert/strict'
import test from 'node:test'
import { checkRateLimit, getClientIp, isSameOriginRequest } from '../lib/security/requestProtection.ts'

test('isSameOriginRequest accepts matching origin and host', () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS
  process.env.ALLOWED_ORIGINS = 'https://example.com'

  const request = new Request('https://example.com/api/auth/delete-account', {
    method: 'POST',
    headers: {
      origin: 'https://example.com',
      host: 'example.com',
      'x-forwarded-proto': 'https',
    },
  })
  try {
    assert.equal(isSameOriginRequest(request), true)
  } finally {
    if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = previousAllowedOrigins
  }
})

test('isSameOriginRequest rejects cross-site origin', () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS
  process.env.ALLOWED_ORIGINS = 'https://example.com'

  const request = new Request('https://example.com/api/auth/delete-account', {
    method: 'POST',
    headers: {
      origin: 'https://evil.example',
      host: 'example.com',
      'x-forwarded-proto': 'https',
    },
  })
  try {
    assert.equal(isSameOriginRequest(request), false)
  } finally {
    if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = previousAllowedOrigins
  }
})

test('isSameOriginRequest rejects state-changing request when origin and referer are missing', () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS
  process.env.ALLOWED_ORIGINS = 'https://example.com'

  const request = new Request('https://example.com/api/auth/delete-account', {
    method: 'POST',
    headers: {
      host: 'example.com',
      'x-forwarded-proto': 'https',
    },
  })
  try {
    assert.equal(isSameOriginRequest(request), false)
  } finally {
    if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = previousAllowedOrigins
  }
})

test('isSameOriginRequest accepts state-changing request with allowed referer when origin is missing', () => {
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS
  process.env.ALLOWED_ORIGINS = 'https://example.com'

  const request = new Request('https://example.com/api/auth/delete-account', {
    method: 'POST',
    headers: {
      referer: 'https://example.com/settings/security',
      host: 'example.com',
      'x-forwarded-proto': 'https',
    },
  })
  try {
    assert.equal(isSameOriginRequest(request), true)
  } finally {
    if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = previousAllowedOrigins
  }
})

test('getClientIp prefers x-forwarded-for first hop', () => {
  const request = new Request('https://example.com/api/turnstile/verify', {
    method: 'POST',
    headers: {
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
    },
  })
  assert.equal(getClientIp(request), '203.0.113.5')
})

test('checkRateLimit blocks after limit is exceeded within window', () => {
  const now = Date.now()
  const first = checkRateLimit({ key: 'test-limit', limit: 2, windowMs: 60_000, nowMs: now })
  const second = checkRateLimit({ key: 'test-limit', limit: 2, windowMs: 60_000, nowMs: now + 1 })
  const third = checkRateLimit({ key: 'test-limit', limit: 2, windowMs: 60_000, nowMs: now + 2 })

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.equal(third.ok, false)
  assert.equal(third.retryAfterSeconds > 0, true)
})
