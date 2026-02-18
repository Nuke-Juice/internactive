import assert from 'node:assert/strict'
import test from 'node:test'
import { POST } from '../app/api/analytics/event/route.ts'
import { resetInMemoryRateLimitsForTests } from '../lib/security/requestProtection.ts'

test('analytics endpoint returns 429 after per-IP threshold', async () => {
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Force deterministic in-memory fallback for this test.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  resetInMemoryRateLimitsForTests()

  try {
    for (let index = 0; index < 180; index += 1) {
      const response = await POST(
        new Request('https://example.com/api/analytics/event', {
          method: 'POST',
          headers: {
            origin: 'https://example.com',
            host: 'example.com',
            'x-forwarded-proto': 'https',
            'x-forwarded-for': '198.51.100.42',
          },
          body: '{',
        })
      )
      assert.equal(response.status, 400)
    }

    const limited = await POST(
      new Request('https://example.com/api/analytics/event', {
        method: 'POST',
        headers: {
          origin: 'https://example.com',
          host: 'example.com',
          'x-forwarded-proto': 'https',
          'x-forwarded-for': '198.51.100.42',
        },
        body: '{',
      })
    )

    assert.equal(limited.status, 429)
  } finally {
    if (previousServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole
    resetInMemoryRateLimitsForTests()
  }
})
