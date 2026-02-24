import assert from 'node:assert/strict'
import test from 'node:test'
import { canViewerAccessInternship } from '../lib/jobs/internshipAccess.ts'

test('public/student viewers can access feed-eligible listings', () => {
  const allowed = canViewerAccessInternship({
    row: {
      id: 'listing-1',
      employer_id: 'employer-1',
      is_active: true,
      status: 'published',
      application_deadline: '2026-12-31',
    },
    viewer: { viewerId: null, viewerRole: null },
  })

  assert.equal(allowed, true)
})

test('employer can access own listing even when not publicly visible', () => {
  const allowed = canViewerAccessInternship({
    row: {
      id: 'listing-2',
      employer_id: 'employer-2',
      is_active: false,
      status: 'draft',
      application_deadline: null,
    },
    viewer: { viewerId: 'employer-2', viewerRole: 'employer' },
  })

  assert.equal(allowed, true)
})

test('non-owner student cannot access inactive listing', () => {
  const allowed = canViewerAccessInternship({
    row: {
      id: 'listing-3',
      employer_id: 'employer-3',
      is_active: false,
      status: 'published',
      application_deadline: null,
    },
    viewer: { viewerId: 'student-1', viewerRole: 'student' },
  })

  assert.equal(allowed, false)
})
