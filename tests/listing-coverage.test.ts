import assert from 'node:assert/strict'
import test from 'node:test'
import { getListingCoverage } from '../lib/listings/getListingCoverage.ts'

test('same listing yields identical coverage across feed/dashboard/edit input shapes', () => {
  const feedShape = {
    majors: ['Accounting'],
    required_skills: ['Excel'],
    preferred_skills: ['Communication'],
    required_skill_ids: ['skill-excel'],
    preferred_skill_ids: ['skill-communication'],
    required_course_category_ids: [],
    target_graduation_years: [],
    target_student_year: 'any',
    term: 'Spring 2026',
    hours_min: 15,
    hours_max: 25,
    work_mode: 'remote',
    location_city: null,
    location_state: null,
  }

  const dashboardShape = {
    ...feedShape,
    verified_required_skill_links_count: 1,
    verified_preferred_skill_links_count: 1,
    required_course_category_links_count: 0,
  }

  const editShape = {
    majors: ['Accounting'],
    required_skills: ['Excel'],
    preferred_skills: ['Communication'],
    required_course_category_ids: [],
    target_graduation_years: [],
    target_student_year: 'any',
    term: 'Spring 2026',
    hours_min: 15,
    hours_max: 25,
    work_mode: 'remote',
    location_city: '',
    location_state: '',
  }

  const feedCoverage = getListingCoverage(feedShape)
  const dashboardCoverage = getListingCoverage(dashboardShape)
  const editCoverage = getListingCoverage(editShape)

  assert.equal(feedCoverage.score, dashboardCoverage.score)
  assert.equal(feedCoverage.score, editCoverage.score)
  assert.deepEqual(feedCoverage.missingFields, dashboardCoverage.missingFields)
  assert.deepEqual(feedCoverage.missingFields, editCoverage.missingFields)
  assert.equal(feedCoverage.missingSummary, 'Missing: Coursework categories')
})

test('graduation years are missing only when listing explicitly restricts years and selects none', () => {
  const coverage = getListingCoverage({
    majors: ['Accounting'],
    required_skills: ['Excel'],
    preferred_skills: [],
    required_course_category_ids: ['cat-accounting'],
    target_all_graduation_years: false,
    target_graduation_years: [],
    target_student_year: 'any',
    term: 'Spring 2026',
    hours_min: 10,
    hours_max: 20,
    work_mode: 'remote',
  })

  assert.equal(coverage.missingFields.includes('Graduation years'), true)
})

test('coursework coverage is satisfied from canonical relation fallback', () => {
  const coverage = getListingCoverage({
    majors: ['Accounting'],
    required_skills: ['Excel'],
    preferred_skills: [],
    internship_required_course_categories: [{ category_id: '11111111-1111-4111-8111-111111111111' }],
    target_graduation_years: [],
    target_student_year: 'any',
    term: 'Spring 2026',
    hours_min: 10,
    hours_max: 20,
    work_mode: 'remote',
  })

  assert.equal(coverage.missingFields.includes('Coursework categories'), false)
})
