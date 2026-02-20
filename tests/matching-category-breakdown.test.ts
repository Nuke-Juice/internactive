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
  assert.equal(availability?.status, 'blocked')
})
