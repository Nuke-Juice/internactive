import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateInternshipMatch } from '../lib/matching.ts'

test('category breakdown uses fixed weights and deterministic earned points', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'internship-fixed-weights',
      majors: ['finance'],
      required_skill_ids: ['skill-a', 'skill-b'],
      work_mode: 'in_person',
      location: 'New York, NY',
      hours_per_week: 25,
      required_course_category_ids: ['cat-a'],
      required_course_category_names: ['Corporate Finance'],
    },
    {
      majors: ['finance'],
      skill_ids: ['skill-a'],
      preferred_work_modes: ['remote'],
      availability_hours_per_week: 20,
      canonical_coursework_category_ids: [],
      canonical_coursework_category_names: [],
    },
    undefined,
    { explain: true }
  )

  assert.ok(match.breakdown)
  const categories = match.breakdown?.categories ?? []
  assert.equal(categories.length, 5)
  assert.equal(categories.reduce((sum, row) => sum + row.weight_points, 0), 100)
  assert.equal(
    Number(categories.reduce((sum, row) => sum + row.earned_points, 0).toFixed(1)),
    Number((match.breakdown?.total_score ?? 0).toFixed(1))
  )
  const availability = categories.find((row) => row.key === 'availability')
  assert.ok(availability)
  assert.equal(availability?.status, 'partial')
})

test('skills category is full when required skills are fully matched and no preferred skills are listed', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'skills-required-only',
      majors: ['finance'],
      required_skill_ids: ['skill-a', 'skill-b'],
    },
    {
      majors: ['finance'],
      skill_ids: ['skill-a', 'skill-b'],
    },
    undefined,
    { explain: true }
  )

  const skills = match.breakdown?.categories.find((row) => row.key === 'skills')
  assert.ok(skills)
  assert.equal(skills?.earned_points, 25)
  assert.equal(skills?.status, 'good')
})

test('major category treats targeted majors as OR and awards full major points on any overlap', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'major-denominator',
      majors: ['finance', 'accounting'],
    },
    {
      majors: ['finance'],
    },
    undefined,
    { explain: true }
  )

  const major = match.breakdown?.categories.find((row) => row.key === 'major')
  assert.ok(major)
  assert.equal(major?.earned_points, 20)
  assert.ok(match.reasons.some((reason) => reason.toLowerCase().includes('your major matches')))
})
