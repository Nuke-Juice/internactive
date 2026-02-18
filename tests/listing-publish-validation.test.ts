import assert from 'node:assert/strict'
import test from 'node:test'
import { LISTING_PUBLISH_ERROR, validateListingForPublish } from '../lib/listings/validateListingForPublish.ts'

function validInput() {
  return {
    title: 'Accounting Intern',
    employerId: 'emp_123',
    workMode: 'hybrid',
    locationCity: 'Salt Lake City',
    locationState: 'UT',
    payMinHourly: 20,
    payMaxHourly: 28,
    hoursMin: 15,
    hoursMax: 25,
    term: 'March 2026 - June 2026 (12 weeks)',
    majors: ['Accounting'],
    shortSummary: 'Support invoice closures and records.',
    description: 'Responsibilities:\n- Support AP/AR reconciliations',
    requiredCourseCategoryIds: ['course_cat_1'],
  }
}

test('publish validation requires at least one coursework category', () => {
  const result = validateListingForPublish({
    ...validInput(),
    requiredCourseCategoryIds: [],
  })

  assert.deepEqual(result, { ok: false, code: LISTING_PUBLISH_ERROR.COURSE_CATEGORIES_REQUIRED })
})

test('publish validation passes when coursework category is present', () => {
  const result = validateListingForPublish(validInput())
  assert.deepEqual(result, { ok: true })
})

