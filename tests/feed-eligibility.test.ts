import assert from 'node:assert/strict'
import test from 'node:test'
import { isFeedEligible } from '../lib/jobs/feedEligibility.ts'

test('active listing with missing coursework and graduation years remains feed-eligible', () => {
  const eligible = isFeedEligible(
    {
      is_active: true,
      status: 'published',
      application_deadline: '2026-12-31',
    },
    { now: new Date('2026-02-23T12:00:00.000Z') }
  )

  assert.equal(eligible, true)
})

test('inactive or archived listings are excluded from feed', () => {
  assert.equal(
    isFeedEligible({ is_active: false, status: 'published', application_deadline: null }),
    false
  )
  assert.equal(
    isFeedEligible({ is_active: true, status: 'archived', application_deadline: null }),
    false
  )
})

test('expired deadline excludes listing from feed', () => {
  const eligible = isFeedEligible(
    {
      is_active: true,
      status: 'published',
      application_deadline: '2026-02-01',
    },
    { now: new Date('2026-02-23T12:00:00.000Z') }
  )
  assert.equal(eligible, false)
})

