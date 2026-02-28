import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMissingProfileFields,
  getMinimumProfileCompleteness,
  isProfileComplete,
  normalizeProfileForValidation,
} from '../lib/profileCompleteness.ts'

test('complete profile passes canonical apply completeness', () => {
  const profile = {
    school: 'University of Utah',
    university_id: 'school-1',
    major_id: 'major-1',
    majors: ['Finance'],
    availability_start_month: 'May',
    availability_hours_per_week: 20,
    year: '2027',
  }

  assert.deepEqual(getMissingProfileFields(profile), [])
  assert.equal(isProfileComplete(profile), true)
  assert.equal(getMinimumProfileCompleteness(profile).ok, true)
})

test('missing field list is precise', () => {
  const profile = {
    school: 'University of Utah',
    major_id: 'major-1',
    availability_start_month: 'May',
    availability_hours_per_week: 0,
    year: '2027',
  }

  assert.deepEqual(getMissingProfileFields(profile), ['availability_hours_per_week'])
})

test('legacy class-standing year is accepted for graduation year completeness', () => {
  const profile = {
    school: 'University of Utah',
    major_id: 'major-1',
    availability_start_month: 'May',
    availability_hours_per_week: '15',
    year: 'Junior',
  }

  assert.deepEqual(getMissingProfileFields(profile), [])
})

test('label-only major still counts when major_id is absent', () => {
  const profile = {
    school: 'University of Utah',
    major: { name: 'Economics' },
    majors: [],
    availability_start_month: 'May',
    availability_hours_per_week: 15,
    year: '2027',
  }

  assert.deepEqual(getMissingProfileFields(profile), [])
})

test('normalizer maps mixed raw keys into canonical shape', () => {
  const normalized = normalizeProfileForValidation({
    school: ' University of Utah ',
    school_id: 123,
    major: 'Finance',
    availabilityHoursPerWeek: '25',
    availabilityStartMonth: 'March',
    graduationYear: '2028',
  })

  assert.equal(normalized.school, 'University of Utah')
  assert.equal(normalized.schoolId, '123')
  assert.equal(normalized.majors.includes('Finance'), true)
  assert.equal(normalized.availabilityHoursPerWeek, 25)
  assert.equal(normalized.availabilityStartMonth, 'March')
  assert.equal(normalized.graduationYear, 2028)
})
